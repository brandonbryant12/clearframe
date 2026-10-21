//! Prepared media: still images and footage. Footage is decoded by FFmpeg (the `ffmpeg` and
//! `ffprobe` tools ClearFrame already uses to encode and mix), one frame at a time and no larger
//! than it is drawn: each open clip is one `ffmpeg` process streaming RGBA through a pipe, so
//! memory is a single frame per clip and the pipe's own buffer. There is never a raw cache of a
//! whole clip.
//!
//! Timing is exact, not estimated: `ffprobe` lists the clip's presentation timestamps once, and
//! film time `t` shows the latest source frame at or before `t`. The clip ends at its last
//! sample's end (last timestamp + its duration), exclusive and rounded up to the film's frame
//! grid, so a final sample keeps its whole duration. A clip that ends before it is needed is
//! an error for the caller, not a frozen or looped frame. Small forward steps read on through
//! the open pipe; a backward step or a far jump restarts the decoder at an accurate seek just
//! before the wanted frame, so any frame can be drawn in any order and comes out the same.
//!
//! Colour: FFmpeg's `scale` filter converts with the source's tagged matrix and range;
//! untagged sources are treated as BT.601 limited range, as FFmpeg's converter does by default.
use skia_safe::{self as sk, AlphaType, ColorType, Data, Image, ImageInfo};
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdout, Command, Stdio};
use std::sync::Arc;

/// Decoders kept open at once (each holds one frame at drawn size).
const MAX_DECODERS: usize = 6;
const MAX_IMAGES: usize = 64;
/// Forward gaps up to this many source frames are read through instead of seeking.
const READ_AHEAD: usize = 90;

/// What `ffprobe` reports about a clip's first video stream.
#[derive(Debug)]
pub struct Probe {
    /// Display size (after the stream's rotation).
    pub width: u32,
    pub height: u32,
    /// Presentation times of every frame, seconds from the clip's first frame, ascending.
    pub pts: Vec<f64>,
    /// End of the last sample, seconds from the first frame.
    pub duration: f64,
    /// Where the first frame sits on the container timeline that `-ss` seeks in.
    start: f64,
}

fn probe(path: &Path) -> Result<Probe, String> {
    let run = |args: &[&str]| -> Result<String, String> {
        let out = Command::new("ffprobe")
            .args(["-v", "error", "-select_streams", "v:0"])
            .args(args)
            .arg(path)
            .stdin(Stdio::null())
            .output()
            .map_err(|e| format!("ffprobe is required to read footage: {e}"))?;
        if !out.status.success() {
            return Err(format!(
                "ffprobe could not read {}: {}",
                path.display(),
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    };
    let meta: serde_json::Value = serde_json::from_str(&run(&[
        "-show_entries",
        "stream=width,height:stream_side_data=rotation:format=start_time",
        "-of",
        "json",
    ])?)
    .map_err(|e| format!("{}: {e}", path.display()))?;
    let stream = &meta["streams"][0];
    let (w, h) = (stream["width"].as_u64().unwrap_or(0) as u32, stream["height"].as_u64().unwrap_or(0) as u32);
    if w == 0 || h == 0 {
        return Err(format!("{} has no video stream", path.display()));
    }
    let rotation =
        stream["side_data_list"].as_array().and_then(|l| l.iter().find_map(|d| d["rotation"].as_f64())).unwrap_or(0.0);
    let quarter = (rotation / 90.0).round().rem_euclid(2.0) == 1.0;
    let format_start = meta["format"]["start_time"].as_str().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
    let mut samples: Vec<(f64, f64)> = run(&["-show_entries", "packet=pts_time,duration_time", "-of", "csv=p=0"])?
        .lines()
        .filter_map(|line| {
            let mut it = line.split(',');
            let pts = it.next()?.trim().parse::<f64>().ok()?;
            let dur = it.next().and_then(|d| d.trim().parse::<f64>().ok()).unwrap_or(0.0);
            Some((pts, dur))
        })
        .collect();
    if samples.is_empty() {
        return Err(format!("{} has no video frames", path.display()));
    }
    samples.sort_by(|a, b| a.0.total_cmp(&b.0));
    samples.dedup_by(|a, b| (a.0 - b.0).abs() < 1e-9);
    let first = samples[0].0;
    let pts: Vec<f64> = samples.iter().map(|s| s.0 - first).collect();
    let n = pts.len();
    // The last sample lasts its own duration, or the clip's typical frame interval.
    let gap = if n > 1 { (pts[n - 1] - pts[0]) / (n - 1) as f64 } else { 1.0 / 30.0 };
    let last = samples[n - 1].1;
    let duration = pts[n - 1] + if last > 0.0 { last } else { gap };
    let (width, height) = if quarter { (h, w) } else { (w, h) };
    Ok(Probe { width, height, pts, duration, start: first - format_start })
}

struct Stream {
    child: Child,
    out: ChildStdout,
    /// Source index of the next frame the pipe will deliver.
    next: usize,
}

impl Drop for Stream {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

struct Clip {
    path: PathBuf,
    probe: Arc<Probe>,
    /// Decoded size.
    size: (u32, u32),
    stream: Option<Stream>,
    buffer: Vec<u8>,
    last: Option<(usize, Image)>,
    used: u64,
}

impl Clip {
    fn open(&mut self, index: usize) -> Result<(), String> {
        self.stream = None;
        let pts = &self.probe.pts;
        // Just before the wanted frame's timestamp: FFmpeg's accurate seek drops every frame
        // earlier than the target, so the first frame out is exactly `index`.
        let before = if index > 0 { (pts[index] - pts[index - 1]) * 0.25 } else { 0.0 };
        let at = (self.probe.start + pts[index] - before.min(0.002)).max(0.0);
        let (w, h) = self.size;
        let filter = if (w, h) == (self.probe.width, self.probe.height) {
            "format=rgba".to_owned()
        } else {
            format!("scale={w}:{h}:flags=bicubic,format=rgba")
        };
        let mut child = Command::new("ffmpeg")
            .args(["-nostdin", "-hide_banner", "-v", "error", "-threads", "1", "-ss", &format!("{at:.6}"), "-i"])
            .arg(&self.path)
            .args([
                "-map",
                "0:v:0",
                "-an",
                "-sn",
                "-vf",
                &filter,
                "-fps_mode",
                "passthrough",
                "-f",
                "rawvideo",
                "-pix_fmt",
                "rgba",
                "pipe:1",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("ffmpeg is required to decode footage: {e}"))?;
        let out = child.stdout.take().ok_or("ffmpeg gave no output pipe")?;
        self.stream = Some(Stream { child, out, next: index });
        Ok(())
    }

    /// Source frame `index`, decoded at `size`.
    fn decode(&mut self, index: usize) -> Result<Image, String> {
        if let Some((at, image)) = &self.last {
            if *at == index {
                return Ok(image.clone());
            }
        }
        let reusable = self.stream.as_ref().is_some_and(|s| s.next <= index && index - s.next <= READ_AHEAD);
        if !reusable {
            self.open(index)?;
        }
        let (w, h) = self.size;
        let bytes = w as usize * h as usize * 4;
        self.buffer.resize(bytes, 0);
        let stream = self.stream.as_mut().unwrap();
        while stream.next <= index {
            if let Err(e) = stream.out.read_exact(&mut self.buffer) {
                self.stream = None;
                return Err(format!("{}: frame {index} could not be decoded ({e})", self.path.display()));
            }
            stream.next += 1;
        }
        let info = ImageInfo::new((w as i32, h as i32), ColorType::RGBA8888, AlphaType::Unpremul, None);
        let image = sk::images::raster_from_data(&info, Data::new_copy(&self.buffer), w as usize * 4)
            .ok_or_else(|| format!("{}: frame {index} could not become an image", self.path.display()))?;
        self.last = Some((index, image.clone()));
        Ok(image)
    }
}

pub struct Media {
    dir: PathBuf,
    fps: usize,
    images: HashMap<String, (Image, u64)>,
    probes: HashMap<String, Arc<Probe>>,
    clips: HashMap<(String, u32, u32), Clip>,
    tick: u64,
}

impl Media {
    pub fn new(dir: &Path, fps: usize) -> Self {
        Media {
            dir: dir.to_path_buf(),
            fps,
            images: HashMap::new(),
            probes: HashMap::new(),
            clips: HashMap::new(),
            tick: 0,
        }
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

    /// The clip's timestamps and display size.
    pub fn probe(&mut self, key: &str) -> Result<Arc<Probe>, String> {
        if let Some(p) = self.probes.get(key) {
            return Ok(p.clone());
        }
        let p = Arc::new(probe(&self.file(key)?).map_err(|e| format!("{key}: {e}"))?);
        self.probes.insert(key.to_owned(), p.clone());
        Ok(p)
    }

    /// Which source frame film time `seconds` (source clock, after offset) shows on the film's
    /// frame grid; `None` past the end of the clip.
    pub fn source_frame(probe: &Probe, seconds: f32, fps: usize) -> Option<usize> {
        let index = (seconds.max(0.0) as f64 * fps as f64 + 1e-3).floor();
        // Exclusive end, rounded up: 49 frames at 24 fps cover 61.25 frames at 30, so frame 61
        // still shows the final sample and 62 is past the end.
        let end = (probe.duration * fps as f64 - 1e-6).ceil();
        if index >= end {
            return None;
        }
        let t = index / fps as f64 + 1e-4;
        Some(probe.pts.partition_point(|p| *p <= t).saturating_sub(1))
    }

    /// The footage frame shown `seconds` into the clip (source clock, after offset), decoded
    /// no larger than `width`×`height` and never larger than the source. `Ok(None)` past the
    /// end of the clip.
    pub fn frame(&mut self, key: &str, seconds: f32, width: u32, height: u32) -> Result<Option<Image>, String> {
        self.tick += 1;
        let probe = self.probe(key)?;
        let Some(index) = Self::source_frame(&probe, seconds, self.fps) else { return Ok(None) };
        let (sw, sh) = (probe.width.max(1), probe.height.max(1));
        let k = (width.clamp(16, 3840) as f32 / sw as f32).max(height.clamp(16, 3840) as f32 / sh as f32).min(1.0);
        let size = if k >= 1.0 {
            (sw, sh)
        } else {
            (((sw as f32 * k) as u32).max(2) & !1, ((sh as f32 * k) as u32).max(2) & !1)
        };
        let id = (key.to_owned(), size.0, size.1);
        if !self.clips.contains_key(&id) {
            if self.clips.len() >= MAX_DECODERS {
                if let Some(old) = self.clips.iter().min_by_key(|(_, c)| c.used).map(|(k, _)| k.clone()) {
                    self.clips.remove(&old);
                }
            }
            let path = self.file(key)?;
            self.clips
                .insert(id.clone(), Clip { path, probe, size, stream: None, buffer: Vec::new(), last: None, used: 0 });
        }
        let clip = self.clips.get_mut(&id).unwrap();
        clip.used = self.tick;
        clip.decode(index).map(Some).map_err(|e| format!("{key}: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixtures() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
    }
    fn pixels(image: &Image) -> Vec<u8> {
        let info = ImageInfo::new(image.dimensions(), ColorType::RGBA8888, AlphaType::Unpremul, None);
        let mut out = vec![0u8; image.width() as usize * image.height() as usize * 4];
        assert!(image.read_pixels(&info, &mut out, image.width() as usize * 4, (0, 0), sk::image::CachingHint::Allow));
        out
    }
    fn at(media: &mut Media, key: &str, index: usize, fps: f32) -> Option<Vec<u8>> {
        media.frame(key, index as f32 / fps, 64, 64).unwrap().map(|i| pixels(&i))
    }
    #[test]
    fn decoding_drains_the_last_b_frame_and_survives_backward_seeks() {
        let mut media = Media::new(&fixtures(), 30);
        let probe = media.probe("bframes.mp4").unwrap();
        assert_eq!(probe.pts.len(), 120);
        assert!((probe.duration - 4.0).abs() < 1e-6);
        let previous = at(&mut media, "bframes.mp4", 118, 30.0).unwrap();
        let last = at(&mut media, "bframes.mp4", 119, 30.0).expect("the last delayed B-frame is drawn");
        assert_ne!(previous, last, "the final sample is decoded, not frame 118 frozen");
        assert_eq!(Media::source_frame(&probe, 119.0 / 30.0, 30), Some(119));
        assert!(at(&mut media, "bframes.mp4", 120, 30.0).is_none(), "the first frame beyond the clip is absent");
        let early = at(&mut media, "bframes.mp4", 30, 30.0).unwrap();
        assert_eq!(
            at(&mut media, "bframes.mp4", 119, 30.0).unwrap(),
            last,
            "a backward seek and return reproduce the frame"
        );
        // A fresh decoder seeking straight to frame 30 gives the frame played up to.
        let mut fresh = Media::new(&fixtures(), 30);
        assert_eq!(at(&mut fresh, "bframes.mp4", 30, 30.0).unwrap(), early);
    }
    #[test]
    fn a_higher_film_rate_holds_each_sample_for_its_whole_interval() {
        let mut media = Media::new(&fixtures(), 60);
        let probe = media.probe("bframes.mp4").unwrap();
        assert_eq!(Media::source_frame(&probe, 238.0 / 60.0, 60), Some(119));
        assert_eq!(
            Media::source_frame(&probe, 239.0 / 60.0, 60),
            Some(119),
            "the final sample still shows at 239/60 s"
        );
        assert_eq!(Media::source_frame(&probe, 240.0 / 60.0, 60), None, "the end stays exclusive");
        assert_eq!(Media::source_frame(&probe, 600.0 / 60.0, 60), None);
        let last = at(&mut media, "bframes.mp4", 238, 60.0).unwrap();
        assert_eq!(at(&mut media, "bframes.mp4", 239, 60.0).unwrap(), last);
        assert_eq!(Media::source_frame(&probe, 1.0, 60), Some(30));
    }
    #[test]
    fn colour_follows_the_clip_tags_and_untagged_clips_are_bt601() {
        // One solid sRGB colour encoded as Blender clips are (BT.709 matrix, tagged) and as an
        // untagged BT.601 clip: both decode back to the source colour.
        let dir = std::env::temp_dir().join(format!("cf-colour-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let encode = |name: &str, matrix: &str, tags: &[&str]| {
            let ok = Command::new("ffmpeg")
                .args([
                    "-v",
                    "error",
                    "-y",
                    "-f",
                    "lavfi",
                    "-i",
                    "color=c=0xC8324B:s=64x64:r=24:d=0.5,format=rgb24",
                    "-c:v",
                    "libx264",
                    "-crf",
                    "10",
                    "-pix_fmt",
                    "yuv420p",
                ])
                .args(["-vf", &format!("scale=in_range=full:out_range=tv:out_color_matrix={matrix}")])
                .args(tags)
                .arg(dir.join(name))
                .status()
                .unwrap()
                .success();
            assert!(ok, "ffmpeg could not write the colour fixture");
        };
        encode(
            "tagged.mp4",
            "bt709",
            &["-color_primaries", "bt709", "-color_trc", "iec61966-2-1", "-colorspace", "bt709", "-color_range", "tv"],
        );
        encode("untagged.mp4", "bt601", &[]);
        let mut media = Media::new(&dir, 24);
        for key in ["tagged.mp4", "untagged.mp4"] {
            let px = pixels(&media.frame(key, 0.1, 64, 64).unwrap().unwrap());
            let centre = &px[(32 * 64 + 32) * 4..(32 * 64 + 32) * 4 + 3];
            for (got, want) in centre.iter().zip([200u8, 50, 75]) {
                assert!((*got as i32 - want as i32).abs() <= 3, "{key}: decoded {centre:?}, source [200, 50, 75]");
            }
        }
        std::fs::remove_dir_all(&dir).ok();
    }
    #[test]
    fn a_final_sample_that_ends_between_film_frames_is_kept() {
        // 49 frames at 24 fps last 61.25 frames at 30 fps: frame 61 shows the last sample.
        let mut media = Media::new(&fixtures(), 30);
        let probe = media.probe("bframes-49-at-24fps.mp4").unwrap();
        assert_eq!(probe.pts.len(), 49);
        assert_eq!(Media::source_frame(&probe, 60.0 / 30.0, 30), Some(48));
        assert_eq!(Media::source_frame(&probe, 61.0 / 30.0, 30), Some(48));
        assert_eq!(Media::source_frame(&probe, 62.0 / 30.0, 30), None);
        let last = at(&mut media, "bframes-49-at-24fps.mp4", 61, 30.0).expect("61/30 s precedes the end at 49/24 s");
        assert!(at(&mut media, "bframes-49-at-24fps.mp4", 62, 30.0).is_none());
        let back = at(&mut media, "bframes-49-at-24fps.mp4", 30, 30.0);
        assert!(back.is_some(), "a backward seek after the end still works");
        assert_eq!(at(&mut media, "bframes-49-at-24fps.mp4", 61, 30.0).unwrap(), last);
        assert_eq!(at(&mut media, "bframes-49-at-24fps.mp4", 60, 30.0).unwrap(), last);
    }
}
