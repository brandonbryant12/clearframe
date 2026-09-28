use clearframe_native::{Film, HEIGHT, WIDTH};
use fframes::{EncoderOptions, MediaDirectory, RenderOptions, cli};
use fframes::cli::clap;
use std::process::ExitCode;

#[derive(Debug, clap::Args)]
struct AppArgs {
    #[arg(long, default_value = "job.json", global = true)]
    job: String,
    #[arg(long, default_value = "media", global = true)]
    media: String,
}

fn run() -> Result<ExitCode, Box<dyn std::error::Error>> {
    let args = cli::parse::<AppArgs>();
    let video = Film::read(&args.app.job)?;
    let directory = MediaDirectory::read_folder(&args.app.media)?;
    let media = directory.process_media_source()?;
    let command = cli::new(&video, RenderOptions {
        media: Some(&media),
        load_system_fonts: false,
        default_font: "Inter",
        video_encoder_options: EncoderOptions {
            preferred_encoder: Some("libx264"),
            // Match the browser's libx264 defaults, with one codec thread per worker.
            gop_size: 250,
            qmin: 0,
            qmax: 69,
            codec_params: Some(&[("crf", "16"), ("preset", "medium"), ("threads", "1")]),
            ..Default::default()
        },
        ..Default::default()
    }).args(args);

    #[cfg(all(feature = "metal", target_os = "macos"))]
    {
        use fframes_skia_renderer::{SkiaFFramesRenderer, SkiaPipelineConfig, SkiaPipelineConcurrencyPolicy, metal::SkiaMetalCtx};
        let gpu = SkiaMetalCtx::new(WIDTH, HEIGHT)?;
        eprintln!("ClearFrame backend: skia-metal; one GPU pipeline, two encoder workers");
        Ok(command.backend(SkiaFFramesRenderer::new_metal(&gpu, SkiaPipelineConfig {
            concurrency_policy: SkiaPipelineConcurrencyPolicy::OnePipeline,
            encoder_threads: 2,
            buffer_queue_size: 2,
        })?).run())
    }
    #[cfg(not(all(feature = "metal", target_os = "macos")))]
    {
        let _ = (WIDTH, HEIGHT);
        eprintln!("ClearFrame backend: cpu (not a GPU benchmark)");
        Ok(command.run())
    }
}

fn main() -> ExitCode {
    match run() {
        Ok(code) => code,
        Err(error) => { eprintln!("{error}"); ExitCode::FAILURE }
    }
}
