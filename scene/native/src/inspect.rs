//! Checks before a render: `inspect` (converter diagnostics of the block layers and native
//! layer errors over sampled frames, in the FFFrames report format the Node `check` reads) and
//! the frame audit (held type cut by the frame or the letterbox, printed over other type or a
//! subject, or too small), judged over block type *and* native type together.
use crate::compose::Engine;
use crate::nodes::TextMark;
use clearframe_native::audit::{self, Scan, Seen};
use clearframe_native::lens::Lens;
use fframes::diagnostics::Severity;

struct Finding {
    severity: Severity,
    key: String,
    message: String,
    first: usize,
    last: usize,
    frames: usize,
    beats: Vec<String>,
}

/// Native type in format pixels (the units the block trees and the audit use).
fn seen(engine: &Engine, marks: &[TextMark]) -> Vec<Seen> {
    let k = engine.plan.format.width as f32 / engine.width as f32;
    let unit = engine.plan.format.width as f32 / engine.logical.0;
    marks
        .iter()
        .map(|m| Seen {
            text: m.text.clone(),
            rect: [m.rect.left * k, m.rect.top * k, m.rect.width() * k, m.rect.height() * k],
            opacity: m.alpha,
            px: m.size * unit,
            masked: false,
        })
        .collect()
}

fn scan(engine: &mut Engine, frame: usize) -> Result<Scan, String> {
    engine.render(frame)?;
    let marks = engine.marks.clone();
    let (_, tree) = engine.block_tree(frame)?;
    let mut out = audit::scan(&tree);
    out.texts.extend(seen(engine, &marks));
    // Letterbox bars are drawn by the engine, not the block layer.
    let i = engine.film.beats.iter().rposition(|b| b.start_frame <= frame).unwrap_or(0);
    let lens = Lens::from(&engine.film.beats[i].lens);
    let bar = crate::film::bar(&lens, engine.logical.0, engine.logical.1) * engine.plan.format.width as f32 / engine.logical.0;
    let (w, h) = (engine.plan.format.width as f32, engine.plan.format.height as f32);
    if bar > 0.25 {
        out.bars.push([0.0, 0.0, w, bar]);
        out.bars.push([0.0, h - bar, w, bar]);
    }
    Ok(out)
}

/// The frame audit at four held moments per beat, each with the frame after it.
pub fn audit(engine: &mut Engine) -> Result<serde_json::Value, String> {
    let samples: Vec<(String, usize)> = engine
        .film
        .beats
        .iter()
        .flat_map(|b| {
            [0.35, 0.6, 0.85, 0.97].map(|p| {
                let last = b.start_frame + b.frames.saturating_sub(2);
                (b.id.clone(), (b.start_frame + (b.frames as f32 * p) as usize).min(last))
            })
        })
        .collect();
    let (w, h) = (engine.plan.format.width as f32, engine.plan.format.height as f32);
    let fps = engine.plan.format.fps as f32;
    let mut report: Vec<serde_json::Value> = vec![];
    for (beat, frame) in samples {
        let now = scan(engine, frame)?;
        let next = scan(engine, (frame + 1).min(engine.plan.format.frames - 1))?;
        for f in audit::judge(&now, &next, w, h) {
            match report.iter_mut().find(|r| r["beat"] == beat && r["kind"] == f.kind && r["text"] == f.text) {
                Some(r) => r["frames"] = (r["frames"].as_u64().unwrap_or(1) + 1).into(),
                None => report.push(serde_json::json!({
                    "beat": beat, "frame": frame, "seconds": frame as f32 / fps,
                    "level": f.level, "kind": f.kind, "text": f.text, "message": f.message, "frames": 1
                })),
            }
        }
    }
    Ok(serde_json::Value::Array(report))
}

/// Sampled diagnostics in the FFFrames `inspect` text format. Returns (report, failed).
pub fn inspect(engine: &mut Engine, every_seconds: f32) -> Result<(String, bool), String> {
    let fps = engine.plan.format.fps as f32;
    let total = engine.plan.format.frames;
    let step = ((every_seconds * fps).round() as usize).max(1);
    let mut frames: Vec<usize> = (0..total).step_by(step).collect();
    for b in &engine.film.beats {
        frames.push(b.start_frame);
        frames.push(b.start_frame + b.frames - 1);
    }
    frames.push(total - 1);
    frames.sort_unstable();
    frames.dedup();
    let (w, h) = (engine.plan.format.width as f32, engine.plan.format.height as f32);
    let mut findings: Vec<Finding> = vec![];
    for &frame in &frames {
        let i = engine.film.beats.iter().rposition(|b| b.start_frame <= frame).unwrap_or(0);
        let (beat_id, local) = (engine.film.beats[i].id.clone(), frame - engine.film.beats[i].start_frame);
        let native = engine.plan.layers.iter().any(|l| l.beat.as_deref() == Some(beat_id.as_str()));
        let mut found: Vec<(Severity, String, String)> = vec![];
        for (sev, key, message) in engine.blocks_inspect(i, local, frame)? {
            // A beat whose picture is native has an empty block layer by design.
            if native && message == "frame is empty" {
                continue;
            }
            found.push((sev, key, message));
        }
        if let Err(e) = engine.render(frame) {
            for line in e.lines() {
                found.push((Severity::Error, format!("native:{line}"), line.to_owned()));
            }
        }
        let marks = engine.marks.clone();
        for s in seen(engine, &marks) {
            let [x, y, rw, rh] = s.rect;
            let inside = x >= -0.5 && y >= -0.5 && x + rw <= w + 0.5 && y + rh <= h + 0.5;
            let outside = x + rw < 0.0 || y + rh < 0.0 || x > w || y > h;
            if !inside && !outside && s.opacity > 0.05 {
                found.push((
                    Severity::Warning,
                    format!("text_clipped:{}", s.text),
                    format!("text \"{}\" is cut off by the canvas edge (x={x:.0} y={y:.0} w={rw:.0} h={rh:.0})", s.text),
                ));
            }
        }
        for (severity, key, message) in found {
            if severity == Severity::Info {
                continue;
            }
            match findings.iter_mut().find(|f| f.key == key) {
                Some(f) => {
                    f.last = frame;
                    f.frames += 1;
                    if !f.beats.contains(&beat_id) {
                        f.beats.push(beat_id.clone());
                    }
                }
                None => findings.push(Finding { severity, key, message, first: frame, last: frame, frames: 1, beats: vec![beat_id.clone()] }),
            }
        }
    }
    findings.sort_by(|a, b| b.severity.cmp(&a.severity).then(a.first.cmp(&b.first)));
    let failed = findings.iter().any(|f| f.severity >= Severity::Error);
    let mut text = format!("checked {} frames: ", frames.len());
    if findings.is_empty() {
        text.push_str("no problems found");
    } else {
        text.push_str(&format!("{} findings", findings.len()));
    }
    for f in &findings {
        text.push_str(&format!(
            "\n{:?} {:.2}s..{:.2}s (frames {}..{}, seen in {}) [{}]: {}",
            f.severity,
            f.first as f32 / fps,
            f.last as f32 / fps,
            f.first,
            f.last,
            f.frames,
            f.beats.join(" + "),
            f.message
        ));
    }
    Ok((text, failed))
}
