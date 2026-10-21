//! Image and footage plates, and annotated screenshots. Plates take the media's own aspect
//! ratio (no letterbox bars), sit inside rounded masks and can drift slowly.
use super::*;

pub(crate) fn media_frame_at(scene_frame: &Frame, offset: f64) -> Frame {
    let mut frame = scene_frame.clone();
    frame.index += (offset * scene_frame.fps as f64).round() as usize;
    frame
}

/// The largest rect with the media's aspect ratio inside `box_`, centred.
fn contain(box_: Area, width: u32, height: u32) -> Area {
    if width == 0 || height == 0 {
        return box_;
    }
    let ratio = width as f32 / height as f32;
    let (w, h) = if box_.w / box_.h > ratio { (box_.h * ratio, box_.h) } else { (box_.w, box_.w / ratio) };
    Area { x: box_.x + (box_.w - w) / 2.0, y: box_.y + (box_.h - h) / 2.0, w, h }
}

impl<'a, 'c> Draw<'a, 'c> {
    fn source(&self, video: bool, drawn: (f32, f32)) -> (sk::Image, u32, u32) {
        let p = self.props();
        self.decoded(s(p, "file"), video, n(p, "offset", n(p, "start", 0.0)), drawn)
    }
    /// A prepared image, or the footage frame at this scene time (plus a source offset),
    /// decoded about `drawn` (job units) large; with the source's own width and height.
    fn decoded(&self, key: &str, video: bool, offset: f64, drawn: (f32, f32)) -> (sk::Image, u32, u32) {
        let mut media = self.ctx.media.borrow_mut();
        let missing = |e: String| -> ! {
            panic!("missing or undecodable prepared {}: {key} ({e})", if video { "video" } else { "image" })
        };
        if video {
            let probe = media.probe(key).unwrap_or_else(|e| missing(e));
            let frame = media_frame_at(&self.f, offset);
            let (w, h) = ((drawn.0 * self.ctx.scale).ceil() as u32, (drawn.1 * self.ctx.scale).ceil() as u32);
            let image = media
                .frame(key, frame.seconds(), w, h)
                .unwrap_or_else(|e| missing(e))
                .unwrap_or_else(|| missing(format!("the clip ends before {:.2} s", frame.seconds())));
            (image, probe.width, probe.height)
        } else {
            let image = media.image(key).unwrap_or_else(|e| missing(e));
            let (w, h) = (image.width() as u32, image.height() as u32);
            (image, w, h)
        }
    }

    /// A beat's image or footage plate: full-bleed behind the block, or one side of a split
    /// frame. The palette treatment, a slow drift and a readability scrim make any photo or
    /// generated still sit inside the film's look.
    pub(crate) fn plate_layer(&self, side: &str) -> Node {
        let Some(plate) = self.b.plate.as_ref() else { return draw::empty() };
        let env = &self.b.environment;
        let (w, h) = (env.width, env.height);
        let video = plate.get("video").and_then(Value::as_bool).unwrap_or(false);
        let box_ = match side {
            "left" => Area { x: 0.0, y: 0.0, w: w * 0.46, h },
            "right" => Area { x: w * 0.54, y: 0.0, w: w * 0.46, h },
            "top" => Area { x: 0.0, y: 0.0, w, h: h * 0.4 },
            "bottom" => Area { x: 0.0, y: h * 0.6, w, h: h * 0.4 },
            _ => Area { x: 0.0, y: 0.0, w, h },
        };
        // Decoded a little larger than the box: the drift scales the plate up to 1.08.
        let (image, iw, ih) =
            self.decoded(s(plate, "file"), video, n(plate, "offset", 0.0), (box_.w * 1.1, box_.h * 1.1));
        // Cover the box around an authored focal point (0–1), like background-position.
        let focus = arr(plate, "focus");
        let (fx, fy) = (
            focus.first().and_then(Value::as_f64).unwrap_or(0.5) as f32,
            focus.get(1).and_then(Value::as_f64).unwrap_or(0.5) as f32,
        );
        let k = (box_.w / iw.max(1) as f32).max(box_.h / ih.max(1) as f32);
        let (dw, dh) = (iw as f32 * k, ih as f32 * k);
        let (ix, iy) = (box_.x + (box_.w - dw) * fx.clamp(0.0, 1.0), box_.y + (box_.h - dh) * fy.clamp(0.0, 1.0));
        let seconds = self.b.frames as f32 / self.f.fps as f32;
        let x = motion::in_out_cubic(self.t / seconds.max(0.1));
        let (cx, cy) = (box_.x + box_.w / 2.0, box_.y + box_.h / 2.0);
        let pan = box_.w * 0.035;
        let drift = |img: Node| match nonempty(s(plate, "drift"), "in") {
            "in" => img.scale_about(1.0 + 0.08 * x, cx, cy),
            "out" => img.scale_about(1.08 - 0.08 * x, cx, cy),
            "left" => img.scale_about(1.08, cx, cy).translate(pan * (1.0 - 2.0 * x), 0.0),
            "right" => img.scale_about(1.08, cx, cy).translate(-pan * (1.0 - 2.0 * x), 0.0),
            "up" => img.scale_about(1.08, cx, cy).translate(0.0, pan * (1.0 - 2.0 * x)),
            "down" => img.scale_about(1.08, cx, cy).translate(0.0, -pan * (1.0 - 2.0 * x)),
            _ => img,
        };
        // A printed plate: the still (or footage frame) becomes paper and a screen in the
        // palette's ink, dots or engraved lines following its darkness.
        let screen = super::canvas::print::Spec::parse(&Value::String(s(plate, "treatment").into()))
            .filter(|p| p.screen != super::canvas::print::Screen::None);
        let img = match screen {
            Some(spec) => {
                let (bg, ink) = (self.p.bg.clone(), self.p.ink.clone());
                self.printed_picture(
                    &image,
                    s(plate, "file"),
                    (ix, iy, dw, dh),
                    (box_.x, box_.y, box_.w, box_.h),
                    &spec,
                    &bg,
                    &ink,
                    !video,
                )
            }
            None => {
                let img = draw::picture(image, ix, iy, dw, dh, draw::Fit::Fill);
                self.treat(img, s(plate, "treatment"))
            }
        };
        // Split plates open from the seam as the scene enters.
        let open = if side == "full" { 1.0 } else { self.m.grow(self.t, 0.9) };
        let (clip_x, clip_y, clip_w, clip_h) = match side {
            "left" => (box_.x + box_.w * (1.0 - open), box_.y, box_.w * open, box_.h),
            "right" => (box_.x, box_.y, box_.w * open, box_.h),
            "top" => (box_.x, box_.y + box_.h * (1.0 - open), box_.w, box_.h * open),
            "bottom" => (box_.x, box_.y, box_.w, box_.h * open),
            _ => (box_.x, box_.y, box_.w, box_.h),
        };
        if clip_w <= 0.5 || clip_h <= 0.5 {
            return draw::empty();
        }
        let scrim_amount = n(plate, "scrim", if side == "full" { 0.78 } else { 0.0 }) as f32;
        let scrim = if scrim_amount > 0.0 {
            let bg = self.p.bg.clone();
            // Heaviest where the text sits: the left in wide frames (or everywhere when centred).
            let centred = s(self.props(), "align") == "center" || !self.wide;
            let (x2, a0, a1) = if centred {
                (1.0, scrim_amount * 0.82, scrim_amount * 0.82)
            } else {
                (1.0, scrim_amount, scrim_amount * 0.3)
            };
            let unit = draw::bbox(Rect::from_xywh(box_.x, box_.y, box_.w, box_.h));
            let wash = draw::linear(
                (0.0, 0.0),
                (x2, 0.0),
                &[(0.0, &bg, a0), (0.62, &bg, (a0 + a1) / 2.0), (1.0, &bg, a1)],
                TileMode::Clamp,
                Some(&unit),
            );
            draw::rect(box_.x, box_.y, box_.w, box_.h).fill_ink(wash).node()
        } else {
            draw::empty()
        };
        let seam = match side {
            "left" => rect(box_.x + box_.w * (1.0 - open) + box_.w * open - 6.0, 0.0, 6.0, h, &self.p.accent),
            "right" => rect(box_.x, 0.0, 6.0, h, &self.p.accent),
            "top" => rect(0.0, box_.y + box_.h - 6.0, w, 6.0, &self.p.accent),
            "bottom" => rect(0.0, box_.y, w, 6.0, &self.p.accent),
            _ => draw::empty(),
        };
        draw::group(vec![
            draw::group(vec![drift(img), scrim]).clip_rect(clip_x, clip_y, clip_w.max(0.0), clip_h.max(0.0)),
            seam,
        ])
    }

    /// Rounded, optionally drifting plate. `cover` fills the box and crops; otherwise the
    /// plate adopts the media's aspect ratio so nothing is cropped.
    fn plate(&self, video: bool, box_: Area, cover: bool, start: f32) -> (Node, Area) {
        let (image, w, h) = self.source(video, (box_.w * 1.07, box_.h * 1.07));
        let frame = if cover { box_ } else { contain(box_, w, h) };
        let seconds = self.b.frames as f32 / self.f.fps as f32;
        let drift = if self.props().get("drift").and_then(Value::as_bool).unwrap_or(false) {
            1.0 + 0.06 * self.m.intensity.max(0.3) * motion::in_out_cubic(self.t / seconds.max(0.1))
        } else {
            1.0
        };
        let (cx, cy) = (frame.x + frame.w / 2.0, frame.y + frame.h / 2.0);
        let radius = 24.0f32.min(frame.w / 8.0).min(frame.h / 8.0);
        let fit = if cover { draw::Fit::Cover } else { draw::Fit::Contain };
        let window = draw::rounded_rect(frame.x, frame.y, frame.w, frame.h, radius, radius).path;
        let body = draw::group(vec![
            rounded(frame.x, frame.y, frame.w, frame.h, radius, &self.p.surface),
            draw::picture(image, frame.x, frame.y, frame.w, frame.h, fit).scale_about(drift, cx, cy).clip(window),
            draw::rounded_rect(frame.x + 0.75, frame.y + 0.75, frame.w - 1.5, frame.h - 1.5, radius, radius)
                .stroke(self.p.line(), 1.5)
                .opacity(0.7)
                .node(),
        ]);
        (self.rise(body, start, 28.0), frame)
    }

    pub(super) fn media(&self, video: bool) -> Node {
        let a = self.area;
        let p = self.props();
        let caption = s(p, "caption");
        let caption_h = if caption.trim().is_empty() { 0.0 } else { 76.0 };
        let cover = s(p, "fit") == "cover";
        let (plate, frame) = self.plate(video, Area { h: a.h - caption_h, ..a }, cover, self.b.cue_seconds - 0.25);
        let (label, _) = self.kicker(s(p, "label"), frame.x, frame.y - 46.0, frame.w.max(320.0), self.b.cue_seconds);
        let (caption, _) = self.para(
            caption,
            Area { x: frame.x, y: frame.y + frame.h + 22.0, w: frame.w.max(a.w * 0.5), h: caption_h - 10.0 },
            Style::text(28.0),
            &self.p.muted,
            Align::Left,
        );
        draw::group(vec![label.into(), plate.into(), self.rise(caption, self.b.cue_seconds + 0.2, 8.0).into()])
    }

    /// Numbered pins on a screenshot with a matching legend and an optional focus region.
    pub(super) fn annotate(&self) -> Node {
        let a = self.area;
        let p = self.props();
        let pins = arr(p, "pins");
        let cue = self.b.cue_seconds;
        let caption = s(p, "caption");
        let caption_h = if caption.trim().is_empty() { 0.0 } else { 64.0 };
        let (image_box, legend) = if self.wide {
            (
                Area { w: a.w * 0.6, h: a.h - caption_h, ..a },
                Area { x: a.x + a.w * 0.6 + 64.0, y: a.y, w: a.w * 0.4 - 64.0, h: a.h },
            )
        } else {
            let h = a.h * 0.56;
            (Area { h: h - caption_h, ..a }, Area { x: a.x, y: a.y + h + 44.0, w: a.w, h: a.h - h - 44.0 })
        };
        let (plate, frame) = self.plate(false, image_box, false, cue - 0.3);
        let mut overlay = vec![];
        let focus = &p["focus"];
        if focus.is_object() {
            let at = n(focus, "at", (cue + 0.4) as f64) as f32;
            let e = self.m.grow(self.t - at, 0.6);
            if e > 0.0 {
                let (fx, fy) =
                    (frame.x + n(focus, "x", 0.0) as f32 * frame.w, frame.y + n(focus, "y", 0.0) as f32 * frame.h);
                let (fw, fh) = (n(focus, "w", 1.0) as f32 * frame.w, n(focus, "h", 1.0) as f32 * frame.h);
                let dim = format!(
                    "M {} {} h {} v {} h {} Z M {fx} {fy} v {fh} h {fw} v {} Z",
                    frame.x, frame.y, frame.w, frame.h, -frame.w, -fh
                );
                overlay.push(draw::group(vec![
                    draw::path(dim).fill(&self.p.bg).even_odd().opacity(0.64 * e).node(),
                    draw::rounded_rect(fx, fy, fw, fh, 12.0, 12.0).stroke(&self.p.accent, 4.0).opacity(e).node(),
                ]));
            }
        }
        let count = pins.len().max(1);
        let row_h = (legend.h / count as f32).min(if self.wide { 170.0 } else { 120.0 });
        let legend_top = legend.y + if self.wide { ((legend.h - row_h * count as f32) / 2.0).max(0.0) } else { 0.0 };
        let mut rows = vec![];
        for (i, pin) in pins.iter().enumerate() {
            let time = n(pin, "at", (cue + 0.7 + i as f32 * 0.6) as f64) as f32;
            let (px, py) = (frame.x + n(pin, "x", 0.5) as f32 * frame.w, frame.y + n(pin, "y", 0.5) as f32 * frame.h);
            let number = format!("{}", i + 1);
            let size = 26.0;
            let w = text::measure(Font::DisplayBold, &number, size, 0.0);
            let pulse = motion::bump((self.t - time) / 0.9);
            let marker = draw::group(vec![
                draw::circle(px, py, 26.0 + 22.0 * pulse).fill(&self.p.accent).opacity(0.25 * pulse).node(),
                draw::circle(px, py, 26.0).fill(&self.p.accent).stroke(&self.p.bg, 4.0).node(),
                self.run(number.clone(), px - w / 2.0, py + size * 0.36, Font::DisplayBold, size, 0.0, &self.p.bg)
                    .into(),
            ]);
            overlay.push(self.pop(marker, time, px, py));
            let y = legend_top + i as f32 * row_h;
            let chip = draw::group(vec![
                draw::circle(legend.x + 20.0, y + 24.0, 20.0).fill(&self.p.accent).node(),
                self.run(
                    number,
                    legend.x + 20.0 - text::measure(Font::DisplayBold, &format!("{}", i + 1), 22.0, 0.0) / 2.0,
                    y + 32.0,
                    Font::DisplayBold,
                    22.0,
                    0.0,
                    &self.p.bg,
                )
                .into(),
            ]);
            let tx = legend.x + 62.0;
            let tw = legend.w - 62.0;
            let label = self.fit(
                s(pin, "label"),
                Style::display(Font::Display, if self.wide { 36.0 } else { 34.0 }),
                tw,
                row_h * 0.46,
            );
            let (detail, _) = self.para(
                s(pin, "detail"),
                Area { x: tx, y: y + label.height() + 6.0, w: tw, h: (row_h - label.height() - 18.0).max(0.0) },
                Style::text(26.0),
                &self.p.muted,
                Align::Left,
            );
            let row = draw::group(vec![
                chip.into(),
                self.draw(&label, tx, y + 24.0 - label.baseline + label.size * 0.36, tw, Align::Left, &self.p.ink)
                    .into(),
                detail.into(),
            ]);
            rows.push(self.rise(row, time + 0.05, 14.0));
        }
        let (caption, _) = self.para(
            caption,
            Area { x: frame.x, y: frame.y + frame.h + 18.0, w: frame.w.max(image_box.w * 0.8), h: caption_h - 8.0 },
            Style::text(24.0),
            &self.p.muted,
            Align::Left,
        );
        let (label, _) = self.kicker(s(p, "label"), frame.x, frame.y - 46.0, frame.w.max(320.0), cue);
        draw::group(vec![label.into(), plate.into(), overlay.into(), rows.into(), caption.into()])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn media_offset_seeks_source_without_delaying_scene_or_global_clock() {
        let scene = Frame::new(15, 315, 30);
        let media = media_frame_at(&scene, 2.0);
        assert_eq!(media.index, 75);
        assert_eq!(media.global_index, 315);
        assert_eq!(media.fps, 30);
        assert_eq!(media_frame_at(&Frame::new(0, 300, 30), 2.0).index, 60);
        assert_eq!(scene.index, 15);
    }
    #[test]
    fn plates_keep_the_media_aspect_ratio_inside_their_box() {
        let box_ = Area { x: 0.0, y: 0.0, w: 1600.0, h: 600.0 };
        let plate = contain(box_, 1920, 1080);
        assert!((plate.w / plate.h - 1920.0 / 1080.0).abs() < 1e-3);
        assert!(plate.h <= 600.0 + 1e-3 && plate.w <= 1600.0 + 1e-3);
        let tall = contain(box_, 1080, 1920);
        assert!((tall.h - 600.0).abs() < 1e-3 && tall.x > 0.0);
        assert_eq!(contain(box_, 0, 10).w, 1600.0);
    }
}
