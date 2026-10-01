use clearframe_native::{Film, NativeFilm};
use fframes::cli::clap;
use fframes::{EncoderOptions, MediaDirectory, RenderOptions, cli};
use std::process::ExitCode;

#[derive(Debug, clap::Args)]
struct AppArgs {
    #[arg(long, default_value = "job.json", global = true)]
    job: String,
    #[arg(long, default_value = "media", global = true)]
    media: String,
    /// Write the frame audit (clipped, covered or unreadable type) as JSON to this file.
    #[arg(long, global = true)]
    audit: Option<String>,
}

fn run_canvas<const W: usize, const H: usize, const RATE: usize>(
    film: Film,
    mut args: cli::Cli<AppArgs>,
) -> Result<ExitCode, Box<dyn std::error::Error>> {
    // Measure text with the exact font files the renderer loads from the prepared job.
    clearframe_native::text::use_font_dir(std::path::Path::new(&args.app.media));
    let directory = MediaDirectory::read_folder(&args.app.media)?;
    let media = directory.process_media_source()?;
    // Four held moments per beat, each with the frame after it to tell held type from moving.
    let samples: Vec<(String, usize)> = film
        .beats
        .iter()
        .flat_map(|b| {
            [0.35, 0.6, 0.85, 0.97].map(|p| {
                let last = b.start_frame + b.frames.saturating_sub(2);
                (b.id.clone(), (b.start_frame + (b.frames as f32 * p) as usize).min(last))
            })
        })
        .collect();
    let video = NativeFilm::<W, H, RATE>(film);
    if let Some(out) = args.app.audit.clone() {
        let options = RenderOptions {
            media: Some(&media),
            load_system_fonts: false,
            default_font: "Inter",
            ..Default::default()
        };
        let mut previewer = fframes::Previewer::new(&video, &options).map_err(|e| format!("{e:?}"))?;
        let mut report: Vec<serde_json::Value> = Vec::new();
        for (beat, frame) in samples {
            let now = previewer.svg_tree(frame).map_err(|e| format!("{e:?}"))?;
            let next = previewer.svg_tree(frame + 1).map_err(|e| format!("{e:?}"))?;
            let (w, h) = (now.size().width(), now.size().height());
            let scan = clearframe_native::audit::scan(&now);
            for f in clearframe_native::audit::judge(&scan, &clearframe_native::audit::scan(&next), w, h) {
                let seen = report.iter_mut().find(|r| r["beat"] == beat && r["kind"] == f.kind && r["text"] == f.text);
                match seen {
                    Some(r) => r["frames"] = (r["frames"].as_u64().unwrap_or(1) + 1).into(),
                    None => report.push(serde_json::json!({
                        "beat": beat, "frame": frame, "seconds": frame as f32 / RATE as f32,
                        "level": f.level, "kind": f.kind, "text": f.text, "message": f.message, "frames": 1
                    })),
                }
            }
        }
        std::fs::write(out, serde_json::to_string_pretty(&report)?)?;
        return Ok(ExitCode::SUCCESS);
    }
    // Upstream --draft replaces codec_params and would drop our thread limit.
    // Resolve it here and keep resource limits in both draft and final encodes.
    let mut draft = false;
    if let Some(cli::Command::Render(ref mut render)) = args.command {
        if render.draft {
            draft = true;
            render.draft = false;
            if args.scale.is_none() {
                args.scale = Some(0.5);
            }
        }
    }
    let scale = args.scale.unwrap_or(1.0);
    if !scale.is_finite() || scale <= 0.0 || scale > 2.0 {
        return Err("scale must be greater than zero and at most 2".into());
    }
    let size = fframes::VideoSize::new_scaled(W, H, scale);
    let width = size.width;
    let height = size.height;
    if width % 2 != 0 || height % 2 != 0 || width < 2 || height < 2 {
        return Err("scaled H.264 canvas must have positive even dimensions".into());
    }
    // Drafts are review copies: a fast preset at a quality that still shows type edges cleanly.
    let codec_params = if draft {
        [("crf", "23"), ("preset", "veryfast"), ("threads", "1")]
    } else {
        [("crf", "16"), ("preset", "medium"), ("threads", "1")]
    };
    let command = cli::new(
        &video,
        RenderOptions {
            media: Some(&media),
            load_system_fonts: false,
            default_font: "Inter",
            video_encoder_options: EncoderOptions {
                preferred_encoder: Some("libx264"),
                gop_size: 250,
                qmin: 0,
                qmax: 69,
                codec_params: Some(&codec_params),
                ..Default::default()
            },
            ..Default::default()
        },
    )
    .args(args);
    #[cfg(all(feature = "metal", target_os = "macos"))]
    {
        use fframes_skia_renderer::{
            SkiaFFramesRenderer, SkiaPipelineConcurrencyPolicy, SkiaPipelineConfig, metal::SkiaMetalCtx,
        };
        let gpu = SkiaMetalCtx::new(width, height)?;
        eprintln!("ClearFrame backend: skia-metal; one GPU pipeline, two encoder workers");
        Ok(command
            .backend(SkiaFFramesRenderer::new_metal(
                &gpu,
                SkiaPipelineConfig {
                    concurrency_policy: SkiaPipelineConcurrencyPolicy::OnePipeline,
                    encoder_threads: 2,
                    buffer_queue_size: 2,
                },
            )?)
            .run())
    }
    #[cfg(not(all(feature = "metal", target_os = "macos")))]
    {
        eprintln!("ClearFrame backend: cpu");
        Ok(command.run())
    }
}

fn dispatch_rate<const W: usize, const H: usize>(
    film: Film,
    args: cli::Cli<AppArgs>,
) -> Result<ExitCode, Box<dyn std::error::Error>> {
    match film.fps {
        24 => run_canvas::<W, H, 24>(film, args),
        25 => run_canvas::<W, H, 25>(film, args),
        30 => run_canvas::<W, H, 30>(film, args),
        50 => run_canvas::<W, H, 50>(film, args),
        60 => run_canvas::<W, H, 60>(film, args),
        _ => Err("unsupported frame rate".into()),
    }
}
fn run() -> Result<ExitCode, Box<dyn std::error::Error>> {
    let args = cli::parse::<AppArgs>();
    let film = Film::read(&args.app.job)?;
    match (film.width, film.height) {
        (1920, 1080) => dispatch_rate::<1920, 1080>(film, args),
        (1080, 1920) => dispatch_rate::<1080, 1920>(film, args),
        (1080, 1080) => dispatch_rate::<1080, 1080>(film, args),
        (1080, 1350) => dispatch_rate::<1080, 1350>(film, args),
        (640, 360) => dispatch_rate::<640, 360>(film, args),
        _ => Err("unsupported canvas".into()),
    }
}
fn main() -> ExitCode {
    match run() {
        Ok(code) => code,
        Err(error) => {
            eprintln!("{error}");
            ExitCode::FAILURE
        }
    }
}
