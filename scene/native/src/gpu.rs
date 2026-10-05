//! The engine's own Metal device, Skia GPU context and render surfaces. One context per
//! process; every surface lives on it, so layers, footage textures and shader programs stay
//! resident between frames.
use fframes_skia_renderer::skia_safe::{
    self as sk, AlphaType, ColorType, ImageInfo, Surface,
    gpu::{self, DirectContext, SurfaceOrigin},
};

pub struct Gpu {
    pub context: DirectContext,
    pub backend: &'static str,
}

impl Gpu {
    /// Metal on macOS. Elsewhere there is no GPU context and surfaces are raster: the same
    /// drawing code, slower, for tests and other platforms.
    pub fn new() -> Result<Option<Self>, String> {
        #[cfg(target_os = "macos")]
        {
            use fframes_skia_renderer::metal::metal_rs;
            use foreign_types_shared::ForeignType;
            let device = metal_rs::Device::system_default().ok_or("no Metal device")?;
            let queue = device.new_command_queue();
            let backend = unsafe {
                gpu::mtl::BackendContext::new(
                    device.as_ptr() as gpu::mtl::Handle,
                    queue.as_ptr() as gpu::mtl::Handle,
                )
            };
            let mut options = gpu::ContextOptions::new();
            options.glyph_cache_texture_maximum_bytes = 64 * 1024 * 1024;
            options.allow_path_mask_caching = true;
            options.runtime_program_cache_size = 256;
            let context =
                gpu::direct_contexts::make_metal(&backend, Some(&options)).ok_or("Skia could not create a Metal context")?;
            // The context holds its own references to the device and queue.
            Ok(Some(Gpu { context, backend: "skia-metal" }))
        }
        #[cfg(not(target_os = "macos"))]
        {
            Ok(None)
        }
    }
}

/// A premultiplied RGBA surface on the GPU (or raster without one).
pub fn surface(gpu: Option<&mut Gpu>, width: i32, height: i32) -> Result<Surface, String> {
    let info = ImageInfo::new((width, height), ColorType::RGBA8888, AlphaType::Premul, None);
    match gpu {
        Some(g) => gpu::surfaces::render_target(
            &mut g.context,
            gpu::Budgeted::Yes,
            &info,
            None,
            SurfaceOrigin::TopLeft,
            None,
            false,
            None,
        ),
        None => sk::surfaces::raster(&info, None, None),
    }
    .ok_or_else(|| format!("cannot create a {width}x{height} surface"))
}

/// Flush the frame and read it back as straight (unpremultiplied) RGBA rows.
pub fn read_rgba(gpu: Option<&mut Gpu>, surface: &mut Surface, pixels: &mut Vec<u8>) -> Result<(), String> {
    let (w, h) = (surface.width(), surface.height());
    let info = ImageInfo::new((w, h), ColorType::RGBA8888, AlphaType::Unpremul, None);
    let row = info.min_row_bytes();
    pixels.resize(row * h as usize, 0);
    let mut context = gpu.map(|g| &mut g.context);
    if let Some(c) = context.as_deref_mut() {
        c.flush_and_submit_surface(surface, None);
    }
    let ok = surface.read_pixels(&info, pixels.as_mut_slice(), row, (0, 0));
    if !ok {
        return Err("failed to read pixels back from the frame surface".into());
    }
    Ok(())
}
