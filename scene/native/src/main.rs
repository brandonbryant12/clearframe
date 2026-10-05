//! `clearframe-scene`: ClearFrame's GPU scene engine.
//!
//!   clearframe-scene --plan build/scene/plan.json [--scale S] [--draft] <command>
//!     info                         format, backend and layers as JSON
//!     frame <list> -o DIR          PNG stills: frames (`120`) or seconds (`4.2s`), comma separated
//!     render [A..B] -o OUT.mp4     H.264 of film frames [A, B) on the film's own clock
//!     inspect [--every S]          sampled diagnostics; exit 2 on errors
//!     audit FILE                   frame audit JSON (held type cut, covered or too small)
//!     bench [A..B]                 draw + readback timings without encoding
//!     serve                        JSON lines on stdin: the engine stays open between requests
#![allow(deprecated)] // skia-safe's gradient_shader/perlin_noise_shader modules, still supported in 0.153
mod compose;
mod encode;
mod film;
mod fonts;
mod geometry;
mod gpu;
mod inspect;
mod legacy;
mod materials;
mod media;
mod nodes;
mod paint;
mod plan;

use compose::Engine;
use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

struct Args {
    plan: PathBuf,
    scale: Option<f32>,
    draft: bool,
    command: Vec<String>,
}

fn parse() -> Result<Args, String> {
    let mut it = std::env::args().skip(1);
    let mut a = Args { plan: PathBuf::from("plan.json"), scale: None, draft: false, command: vec![] };
    while let Some(x) = it.next() {
        match x.as_str() {
            "--plan" => a.plan = PathBuf::from(it.next().ok_or("--plan needs a file")?),
            "--scale" => a.scale = Some(it.next().ok_or("--scale needs a number")?.parse().map_err(|_| "bad --scale")?),
            "--draft" => a.draft = true,
            _ => a.command.push(x),
        }
    }
    if a.command.is_empty() {
        return Err("usage: clearframe-scene --plan PLAN [--scale S] [--draft] info|frame|render|inspect|audit|bench|serve".into());
    }
    Ok(a)
}

fn option(rest: &[String], name: &str) -> Option<String> {
    rest.iter().position(|x| x == name).and_then(|i| rest.get(i + 1)).cloned()
}

fn positional(rest: &[String]) -> Vec<String> {
    let mut out = vec![];
    let mut skip = false;
    for x in rest {
        if skip {
            skip = false;
            continue;
        }
        if x.starts_with("--") || x == "-o" {
            skip = !matches!(x.as_str(), "--fail-on-never");
            continue;
        }
        out.push(x.clone());
    }
    out
}

/// `120`, `4.2s` → film frames (seconds round to the nearest frame, as FFFrames resolved them).
fn frames_of(list: &str, fps: u32, total: usize) -> Result<Vec<usize>, String> {
    list.split(',')
        .filter(|s| !s.trim().is_empty())
        .map(|s| {
            let s = s.trim();
            let f = match s.strip_suffix('s') {
                Some(sec) => (sec.parse::<f64>().map_err(|_| format!("bad time {s}"))? * fps as f64).round().max(0.0) as usize,
                None => s.parse::<usize>().map_err(|_| format!("bad frame {s}"))?,
            };
            if f >= total { Err(format!("{s} is outside the film (0..{total} frames)")) } else { Ok(f) }
        })
        .collect()
}

fn range_of(spec: Option<&String>, total: usize) -> Result<(usize, usize), String> {
    match spec {
        None => Ok((0, total)),
        Some(r) => {
            let (a, b) = r.split_once("..").ok_or("a range is A..B")?;
            let (a, b): (usize, usize) = (a.parse().map_err(|_| "bad range start")?, b.parse().map_err(|_| "bad range end")?);
            if a >= b || b > total {
                return Err(format!("range {a}..{b} is outside the film (0..{total})"));
            }
            Ok((a, b))
        }
    }
}

/// Stills: the GPU draws frame after frame while up to two worker threads compress and write
/// the previous ones (the two-worker limit).
fn write_frames(engine: &mut Engine, frames: &[usize], dir: &Path) -> Result<Vec<String>, String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let (w, h) = (engine.width, engine.height);
    let (tx, rx) = std::sync::mpsc::sync_channel::<(PathBuf, Vec<u8>)>(2);
    let rx = std::sync::Arc::new(std::sync::Mutex::new(rx));
    let workers: Vec<_> = (0..2.min(frames.len()))
        .map(|_| {
            let rx = rx.clone();
            std::thread::spawn(move || -> Result<(), String> {
                loop {
                    let job = rx.lock().unwrap().recv();
                    let Ok((file, pixels)) = job else { return Ok(()) };
                    let png = compose::encode_png(&pixels, w, h)?;
                    std::fs::write(&file, png).map_err(|e| format!("{}: {e}", file.display()))?;
                }
            })
        })
        .collect();
    let mut files = vec![];
    let mut failure = None;
    for &f in frames {
        let mut pixels = Vec::new();
        if let Err(e) = engine.render(f).and_then(|_| engine.read(&mut pixels)) {
            failure = Some(e);
            break;
        }
        let file = dir.join(format!("frame-{f:06}.png"));
        files.push(file.to_string_lossy().into_owned());
        if tx.send((file, pixels)).is_err() {
            break;
        }
    }
    drop(tx);
    for worker in workers {
        worker.join().map_err(|_| "a still writer panicked".to_string())??;
    }
    match failure {
        Some(e) => Err(e),
        None => Ok(files),
    }
}

fn render(engine: &mut Engine, a: usize, b: usize, out: &Path, draft: bool) -> Result<serde_json::Value, String> {
    let ffmpeg = std::env::var("CLEARFRAME_FFMPEG").unwrap_or_else(|_| "ffmpeg".into());
    let settings = encode::Settings { width: engine.width, height: engine.height, fps: engine.plan.format.fps, draft, ffmpeg: &ffmpeg };
    let mut enc = encode::Encoder::start(out, &settings)?;
    let start = Instant::now();
    let (mut draw_ms, mut read_ms) = (0.0f64, 0.0f64);
    for f in a..b {
        let t = Instant::now();
        engine.render(f).map_err(|e| format!("frame {f}: {e}"))?;
        let t2 = Instant::now();
        let mut px = Vec::new();
        engine.read(&mut px)?;
        draw_ms += (t2 - t).as_secs_f64() * 1e3;
        read_ms += t2.elapsed().as_secs_f64() * 1e3;
        enc.push(px)?;
        let done = f + 1 - a;
        if done % 60 == 0 || f + 1 == b {
            eprintln!("frames {done}/{} ({:.0}%)", b - a, done as f32 * 100.0 / (b - a) as f32);
        }
    }
    let frames = enc.finish()?;
    Ok(serde_json::json!({
        "frames": frames, "range": [a, b], "seconds": start.elapsed().as_secs_f64(),
        "drawMs": draw_ms, "readbackMs": read_ms, "backend": engine.backend(),
        "width": engine.width, "height": engine.height, "fps": engine.plan.format.fps
    }))
}

fn info(engine: &Engine) -> serde_json::Value {
    serde_json::json!({
        "engine": "clearframe-scene", "backend": engine.backend(),
        "width": engine.width, "height": engine.height, "fps": engine.plan.format.fps, "frames": engine.plan.format.frames,
        "logical": [engine.logical.0, engine.logical.1],
        "layers": engine.plan.layers.iter().map(|l| serde_json::json!({"id": l.id, "beat": l.beat, "start": l.start, "frames": l.frames})).collect::<Vec<_>>(),
        "beats": engine.film.beats.len(),
    })
}

fn scale_for(args_scale: Option<f32>, draft: bool) -> f32 {
    args_scale.unwrap_or(if draft { 0.5 } else { 1.0 })
}

/// JSON-lines server: one engine (GPU context, fonts, media decoders, shader programs) kept
/// warm across requests. Requests: {id, cmd: open|frame|render|inspect|audit|info|quit, …}.
fn serve(mut engine: Engine, draft: bool) -> Result<(), String> {
    let stdin = std::io::stdin();
    let mut stdout = std::io::stdout();
    let mut draft = draft;
    let reply = |out: &mut std::io::Stdout, v: serde_json::Value| {
        let _ = writeln!(out, "{v}");
        let _ = out.flush();
    };
    reply(&mut stdout, serde_json::json!({"ready": true, "info": info(&engine)}));
    for line in stdin.lock().lines() {
        let line = line.map_err(|e| e.to_string())?;
        if line.trim().is_empty() {
            continue;
        }
        let req: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                reply(&mut stdout, serde_json::json!({"ok": false, "error": format!("bad request: {e}")}));
                continue;
            }
        };
        let id = req.get("id").cloned().unwrap_or(serde_json::Value::Null);
        let t = Instant::now();
        let cmd = req.get("cmd").and_then(|v| v.as_str()).unwrap_or("");
        let result: Result<serde_json::Value, String> = match cmd {
            "quit" => {
                reply(&mut stdout, serde_json::json!({"id": id, "ok": true}));
                return Ok(());
            }
            "info" => Ok(info(&engine)),
            "open" => {
                let plan = req.get("plan").and_then(|v| v.as_str()).unwrap_or("");
                draft = req.get("draft").and_then(|v| v.as_bool()).unwrap_or(draft);
                let scale = req.get("scale").and_then(|v| v.as_f64()).map(|s| s as f32);
                Engine::open(Path::new(plan), scale_for(scale, draft)).map(|e| {
                    engine = e;
                    info(&engine)
                })
            }
            "frame" => {
                let frames: Vec<usize> =
                    req.get("frames").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_u64().map(|n| n as usize)).collect()).unwrap_or_default();
                let dir = PathBuf::from(req.get("dir").and_then(|v| v.as_str()).unwrap_or("."));
                write_frames(&mut engine, &frames, &dir).map(|files| serde_json::json!({"files": files}))
            }
            "render" => {
                let out = PathBuf::from(req.get("out").and_then(|v| v.as_str()).unwrap_or("out.mp4"));
                let range = req.get("range").and_then(|v| v.as_array());
                let (a, b) = range
                    .and_then(|r| Some((r.first()?.as_u64()? as usize, r.get(1)?.as_u64()? as usize)))
                    .unwrap_or((0, engine.plan.format.frames));
                render(&mut engine, a, b, &out, req.get("draft").and_then(|v| v.as_bool()).unwrap_or(draft))
            }
            "inspect" => inspect::inspect(&mut engine, 0.25).map(|(text, failed)| serde_json::json!({"report": text, "failed": failed})),
            "audit" => inspect::audit(&mut engine),
            other => Err(format!("unknown command {other:?}")),
        };
        let ms = t.elapsed().as_secs_f64() * 1e3;
        match result {
            Ok(v) => reply(&mut stdout, serde_json::json!({"id": id, "ok": true, "ms": ms, "result": v})),
            Err(e) => reply(&mut stdout, serde_json::json!({"id": id, "ok": false, "ms": ms, "error": e})),
        }
    }
    Ok(())
}

fn run() -> Result<ExitCode, String> {
    let args = parse()?;
    let t0 = Instant::now();
    let mut engine = Engine::open(&args.plan, scale_for(args.scale, args.draft))?;
    let opened = t0.elapsed();
    let cmd = args.command[0].as_str();
    let rest = &args.command[1..];
    match cmd {
        "info" => {
            let mut v = info(&engine);
            v["openMs"] = (opened.as_secs_f64() * 1e3).into();
            println!("{v}");
        }
        "frame" => {
            let spec = positional(rest).into_iter().next().ok_or("frame needs a list of frames or times")?;
            let dir = PathBuf::from(option(rest, "-o").ok_or("frame needs -o DIR")?);
            let frames = frames_of(&spec, engine.plan.format.fps, engine.plan.format.frames)?;
            let t = Instant::now();
            let files = write_frames(&mut engine, &frames, &dir)?;
            eprintln!(
                "{} still(s) in {:.0} ms after opening in {:.0} ms ({})",
                files.len(),
                t.elapsed().as_secs_f64() * 1e3,
                opened.as_secs_f64() * 1e3,
                engine.backend()
            );
        }
        "render" => {
            let pos = positional(rest);
            let (a, b) = range_of(pos.first(), engine.plan.format.frames)?;
            let out = PathBuf::from(option(rest, "-o").ok_or("render needs -o OUT.mp4")?);
            eprintln!("ClearFrame engine: scene ({}), {}x{} at {} fps, frames {a}..{b}", engine.backend(), engine.width, engine.height, engine.plan.format.fps);
            let mut report = render(&mut engine, a, b, &out, args.draft)?;
            report["openMs"] = (opened.as_secs_f64() * 1e3).into();
            if let Some(r) = option(rest, "--report") {
                std::fs::write(r, serde_json::to_string_pretty(&report).unwrap()).map_err(|e| e.to_string())?;
            }
        }
        "inspect" => {
            let every = option(rest, "--every").and_then(|s| s.trim_end_matches('s').parse().ok()).unwrap_or(0.25);
            let (text, failed) = inspect::inspect(&mut engine, every)?;
            println!("{text}");
            if failed && option(rest, "--fail-on").as_deref() != Some("never") {
                return Ok(ExitCode::from(2));
            }
        }
        "audit" => {
            let out = positional(rest).into_iter().next().ok_or("audit needs an output file")?;
            let report = inspect::audit(&mut engine)?;
            std::fs::write(out, serde_json::to_string_pretty(&report).unwrap()).map_err(|e| e.to_string())?;
        }
        "bench" => {
            let pos = positional(rest);
            let (a, b) = range_of(pos.first(), engine.plan.format.frames)?;
            let mut times = vec![];
            let mut px = Vec::new();
            for f in a..b {
                let t = Instant::now();
                engine.render(f)?;
                engine.read(&mut px)?;
                times.push(t.elapsed().as_secs_f64() * 1e3);
            }
            let first = times.first().copied().unwrap_or(0.0);
            let mut warm = times.iter().skip(1).copied().collect::<Vec<_>>();
            warm.sort_by(f64::total_cmp);
            let median = warm.get(warm.len() / 2).copied().unwrap_or(first);
            println!(
                "{}",
                serde_json::json!({"openMs": opened.as_secs_f64() * 1e3, "firstFrameMs": first, "medianWarmFrameMs": median,
                    "totalMs": times.iter().sum::<f64>(), "frames": times.len(), "backend": engine.backend(),
                    "width": engine.width, "height": engine.height})
            );
        }
        "serve" => serve(engine, args.draft)?,
        other => return Err(format!("unknown command {other}")),
    }
    Ok(ExitCode::SUCCESS)
}

fn main() -> ExitCode {
    match run() {
        Ok(code) => code,
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}
