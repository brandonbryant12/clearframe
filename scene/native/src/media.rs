//! Prepared media for native layers: still images and footage. Footage is decoded in order,
//! one frame at a time, at the size it is drawn (never a raw cache of the whole clip), with a
//! hard memory bound per decoder. A clip that ends before it is needed is an error, not a
//! frozen last frame: holding is only possible when an author asks for it (`hold: true`).
use fframes::FFramesSyncedVideoFrame;
use fframes::media::{FFmpegDecoder, FrameConvertOptions, ResizeVideoFrame};
use fframes_skia_renderer::skia_safe::{self as sk, AlphaType, ColorType, Data, Image, ImageInfo};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Decoders kept open at once (each holds two frames at drawn size).
const MAX_DECODERS: usize = 6;
const MAX_IMAGES: usize = 64;

struct Clip {
    decoder: FFmpegDecoder,
    used: u64,
    size: (u32, u32),
    last: Option<(i64, Image)>,
}

pub struct Media {
    dir: PathBuf,
    fps: usize,
    images: HashMap<String, (Image, u64)>,
    clips: HashMap<(String, u32, u32), Clip>,
    tick: u64,
}

impl Media {
    pub fn new(dir: &Path, fps: usize) -> Self {
        Media { dir: dir.to_path_buf(), fps, images: HashMap::new(), clips: HashMap::new(), tick: 0 }
    }

    fn file(&self, key: &str) -> Result<PathBuf, String> {
        if key.is_empty() || key.contains('/') || key.contains("..") {
            return Err(format!("media key {key:?} must be a staged file name"));
        }
        let path = self.dir.join(key);
        if !path.is_file() {
            return Err(format!("prepared media {key} is missing"));
        }
        Ok(path)
    }

    pub fn image(&mut self, key: &str) -> Result<Image, String> {
        self.tick += 1;
        if let Some((image, used)) = self.images.get_mut(key) {
            *used = self.tick;
            return Ok(image.clone());
        }
        let bytes = std::fs::read(self.file(key)?).map_err(|e| format!("{key}: {e}"))?;
        let image = Image::from_encoded(Data::new_copy(&bytes))
            .ok_or_else(|| format!("prepared image {key} could not be decoded"))?
            .make_raster_image(None, sk::image::CachingHint::Allow)
            .ok_or_else(|| format!("prepared image {key} could not be rasterized"))?;
        if self.images.len() >= MAX_IMAGES {
            if let Some(old) = self.images.iter().min_by_key(|(_, (_, u))| *u).map(|(k, _)| k.clone()) {
                self.images.remove(&old);
            }
        }
        self.images.insert(key.to_owned(), (image.clone(), self.tick));
        Ok(image)
    }

    /// The footage frame shown `seconds` into the clip (source clock, after offset), decoded
    /// at about `width`×`height`. `Ok(None)` past the end of the clip.
    pub fn frame(&mut self, key: &str, seconds: f32, width: u32, height: u32) -> Result<Option<Image>, String> {
        self.tick += 1;
        let path = self.file(key)?;
        let size = (width.clamp(16, 3840) & !1, height.clamp(16, 3840) & !1);
        let id = (key.to_owned(), size.0, size.1);
        if !self.clips.contains_key(&id) {
            if self.clips.len() >= MAX_DECODERS {
                if let Some(old) = self.clips.iter().min_by_key(|(_, c)| c.used).map(|(k, _)| k.clone()) {
                    self.clips.remove(&old);
                }
            }
            let decoder = unsafe { FFmpegDecoder::new(&path, self.fps, 2) }.map_err(|e| format!("{key}: {e:?}"))?;
            self.clips.insert(id.clone(), Clip { decoder, used: self.tick, size, last: None });
        }
        let clip = self.clips.get_mut(&id).unwrap();
        clip.used = self.tick;
        let index = (seconds.max(0.0) * self.fps as f32 + 1e-3).floor() as i64;
        if let Some((at, image)) = &clip.last {
            if *at == index {
                return Ok(Some(image.clone()));
            }
        }
        let present = unsafe { clip.decoder.decode_up_to(index) }.map_err(|e| format!("{key}: {e:?}"))?;
        if !present {
            return Ok(None);
        }
        let raw = clip.decoder.get_raw_frame();
        let (sw, sh) = (raw.width().max(1), raw.height().max(1));
        // Decode no larger than drawn, keeping the source aspect.
        let k = (clip.size.0 as f32 / sw as f32).max(clip.size.1 as f32 / sh as f32).min(1.0);
        let (tw, th) = (((sw as f32 * k) as u32).max(2) & !1, ((sh as f32 * k) as u32).max(2) & !1);
        let data = if tw < sw {
            raw.into_resized_image(&FrameConvertOptions { resize: ResizeVideoFrame { width: tw, height: th } })
                .ok_or_else(|| format!("{key}: frame could not be resized"))?
        } else {
            raw.into_image()
        };
        let pixels = data.href();
        let info = ImageInfo::new(
            (pixels.width as i32, pixels.height as i32),
            ColorType::RGBA8888,
            AlphaType::Premul,
            None,
        );
        let image = sk::images::raster_from_data(&info, Data::new_copy(&pixels.data), pixels.width as usize * 4)
            .ok_or_else(|| format!("{key}: frame could not become an image"))?;
        clip.last = Some((index, image.clone()));
        Ok(Some(image))
    }
}
