//! H.264 through an FFmpeg child process: straight RGBA frames on a pipe, converted with the
//! BT.601 limited-range matrix the FFFrames encoder applied (sRGB picture values; the finisher
//! tags primaries/transfer/matrix/range), libx264 with the same quality settings as before and
//! at most two encoder threads. A bounded queue of two frames keeps memory flat: drawing the
//! next frame overlaps encoding of the last.
use std::io::Write;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{SyncSender, sync_channel};
use std::thread::JoinHandle;

pub struct Encoder {
    child: Child,
    tx: Option<SyncSender<Vec<u8>>>,
    writer: Option<JoinHandle<Result<(), String>>>,
    pub frames: usize,
}

pub struct Settings<'a> {
    pub width: i32,
    pub height: i32,
    pub fps: u32,
    pub draft: bool,
    pub ffmpeg: &'a str,
}

impl Encoder {
    pub fn start(out: &Path, s: &Settings) -> Result<Encoder, String> {
        let (crf, preset) = if s.draft { ("21", "veryfast") } else { ("16", "medium") };
        let size = format!("{}x{}", s.width, s.height);
        let fps = s.fps.to_string();
        let mut child = Command::new(s.ffmpeg)
            .args(["-y", "-hide_banner", "-loglevel", "error", "-nostdin", "-threads", "2", "-filter_threads", "1"])
            .args(["-f", "rawvideo", "-pix_fmt", "rgba", "-s", &size, "-framerate", &fps, "-i", "-"])
            .args(["-vf", "scale=in_range=full:out_range=tv:out_color_matrix=bt601,format=yuv420p"])
            .args(["-c:v", "libx264", "-preset", preset, "-crf", crf, "-g", "250", "-qmin", "0", "-qmax", "69"])
            .args(["-x264-params", "aq-mode=3", "-threads", "2"])
            .args(["-color_primaries", "bt709", "-color_trc", "iec61966-2-1", "-colorspace", "smpte170m", "-color_range", "tv"])
            .args(["-an", "-movflags", "+faststart"])
            .arg(out)
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("cannot start {}: {e}", s.ffmpeg))?;
        let mut stdin = child.stdin.take().ok_or("ffmpeg stdin unavailable")?;
        let (tx, rx) = sync_channel::<Vec<u8>>(2);
        let writer = std::thread::spawn(move || -> Result<(), String> {
            for frame in rx {
                stdin.write_all(&frame).map_err(|e| format!("encoder pipe closed: {e}"))?;
            }
            Ok(())
        });
        Ok(Encoder { child, tx: Some(tx), writer: Some(writer), frames: 0 })
    }

    pub fn push(&mut self, rgba: Vec<u8>) -> Result<(), String> {
        self.tx.as_ref().ok_or("encoder closed")?.send(rgba).map_err(|_| "encoder stopped early".to_string())?;
        self.frames += 1;
        Ok(())
    }

    pub fn finish(mut self) -> Result<usize, String> {
        drop(self.tx.take());
        let wrote = self.writer.take().map(|w| w.join().unwrap_or(Err("encoder writer panicked".into()))).unwrap_or(Ok(()));
        let out = self.child.wait_with_output().map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(format!("ffmpeg failed: {}", String::from_utf8_lossy(&out.stderr)));
        }
        wrote?;
        Ok(self.frames)
    }
}
