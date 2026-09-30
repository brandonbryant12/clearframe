//! Image and footage plates, and annotated screenshots. Plates take the media's own aspect
//! ratio (no letterbox bars), sit inside rounded masks and can drift slowly.
use super::*;
use fframes::{FFramesSyncedVideoFrame, SyncVideoFrameInput};

pub(crate) fn media_frame_at(scene_frame: &Frame, offset: f64) -> Frame {
    let mut frame = scene_frame.clone();
    frame.index += (offset * scene_frame.fps as f64).round() as usize;
    frame
}

/// The largest rect with the media's aspect ratio inside `box_`, centred.
fn contain(box_: Area, width: u32, height: u32) -> Area {
    if width == 0 || height == 0 { return box_; }
    let ratio = width as f32 / height as f32;
    let (w, h) = if box_.w / box_.h > ratio { (box_.h * ratio, box_.h) } else { (box_.w, box_.w / ratio) };
    Area { x: box_.x + (box_.w - w) / 2.0, y: box_.y + (box_.h - h) / 2.0, w, h }
}

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    fn source(&self, video: bool) -> (std::sync::Arc<fframes::usvgr::PreloadedImageData>, u32, u32) {
        let p = self.props();
        self.decoded(s(p, "file"), video, n(p, "offset", n(p, "start", 0.0)), p.get("loop").and_then(Value::as_bool).unwrap_or(false))
    }
    /// A prepared image, or the footage frame at this scene time (plus a source offset).
    fn decoded(&self, key: &str, video: bool, offset: f64, looping: bool) -> (std::sync::Arc<fframes::usvgr::PreloadedImageData>, u32, u32) {
        let image = if video {
            let media_frame = media_frame_at(&self.f, offset);
            media_frame.get_synced_video_frame(self.ctx, key, &SyncVideoFrameInput {
                start_from: 0.0, looping, editor_fallback_image: None,
            }).map(|frame| frame.into_image().href())
        } else { self.ctx.get_image(key).map(|image| image.href()) };
        let image = image.unwrap_or_else(|| panic!("missing or undecodable prepared {}: {}", if video { "video" } else { "image" }, key));
        let (w, h) = (image.width, image.height);
        (image, w, h)
    }

    /// A beat's image or footage plate: full-bleed behind the block, or one side of a split
    /// frame. The palette treatment, a slow drift and a readability scrim make any photo or
    /// generated still sit inside the film's look.
    pub(crate) fn plate_layer(&self, side: &str) -> Svgr<'a> {
        let Some(plate) = self.b.plate.as_ref() else { return fframes::svgr!(<g />) };
        let env = &self.b.environment;
        let (w, h) = (env.width, env.height);
        let video = plate.get("video").and_then(Value::as_bool).unwrap_or(false);
        let (image, iw, ih) = self.decoded(s(plate, "file"), video, n(plate, "offset", 0.0), plate.get("loop").and_then(Value::as_bool).unwrap_or(false));
        let box_ = match side {
            "left" => Area { x: 0.0, y: 0.0, w: w * 0.46, h },
            "right" => Area { x: w * 0.54, y: 0.0, w: w * 0.46, h },
            "top" => Area { x: 0.0, y: 0.0, w, h: h * 0.4 },
            "bottom" => Area { x: 0.0, y: h * 0.6, w, h: h * 0.4 },
            _ => Area { x: 0.0, y: 0.0, w, h },
        };
        // Cover the box around an authored focal point (0–1), like background-position.
        let focus = arr(plate, "focus");
        let (fx, fy) = (focus.first().and_then(Value::as_f64).unwrap_or(0.5) as f32, focus.get(1).and_then(Value::as_f64).unwrap_or(0.5) as f32);
        let k = (box_.w / iw.max(1) as f32).max(box_.h / ih.max(1) as f32);
        let (dw, dh) = (iw as f32 * k, ih as f32 * k);
        let (ix, iy) = (box_.x + (box_.w - dw) * fx.clamp(0.0, 1.0), box_.y + (box_.h - dh) * fy.clamp(0.0, 1.0));
        let seconds = self.b.frames as f32 / self.f.fps as f32;
        let x = motion::in_out_cubic(self.t / seconds.max(0.1));
        let (cx, cy) = (box_.x + box_.w / 2.0, box_.y + box_.h / 2.0);
        let pan = box_.w * 0.035;
        let drift = match nonempty(s(plate, "drift"), "in") {
            "in" => format!("translate({cx} {cy}) scale({}) translate({} {})", 1.0 + 0.08 * x, -cx, -cy),
            "out" => format!("translate({cx} {cy}) scale({}) translate({} {})", 1.08 - 0.08 * x, -cx, -cy),
            "left" => format!("translate({} 0) translate({cx} {cy}) scale(1.08) translate({} {})", pan * (1.0 - 2.0 * x), -cx, -cy),
            "right" => format!("translate({} 0) translate({cx} {cy}) scale(1.08) translate({} {})", -pan * (1.0 - 2.0 * x), -cx, -cy),
            "up" => format!("translate(0 {}) translate({cx} {cy}) scale(1.08) translate({} {})", pan * (1.0 - 2.0 * x), -cx, -cy),
            "down" => format!("translate(0 {}) translate({cx} {cy}) scale(1.08) translate({} {})", -pan * (1.0 - 2.0 * x), -cx, -cy),
            _ => "translate(0 0)".to_owned(),
        };
        let img = fframes::svgr!(<image x={ix} y={iy} width={dw} height={dh} preserveAspectRatio="none" href={image} />);
        let img = self.treat(img, s(plate, "treatment"));
        // Split plates open from the seam as the scene enters.
        let open = if side == "full" { 1.0 } else { self.m.grow(self.t, 0.9) };
        let (clip_x, clip_y, clip_w, clip_h) = match side {
            "left" => (box_.x + box_.w * (1.0 - open), box_.y, box_.w * open, box_.h),
            "right" => (box_.x, box_.y, box_.w * open, box_.h),
            "top" => (box_.x, box_.y + box_.h * (1.0 - open), box_.w, box_.h * open),
            "bottom" => (box_.x, box_.y, box_.w, box_.h * open),
            _ => (box_.x, box_.y, box_.w, box_.h),
        };
        if clip_w <= 0.5 || clip_h <= 0.5 { return fframes::svgr!(<g />); }
        let id = self.uid("plate");
        let scrim_amount = n(plate, "scrim", if side == "full" { 0.78 } else { 0.0 }) as f32;
        let scrim = if scrim_amount > 0.0 {
            let gid = self.uid("scrim");
            let bg = self.p.bg.clone();
            // Heaviest where the text sits: the left in wide frames (or everywhere when centred).
            let centred = s(self.props(), "align") == "center" || !self.wide;
            let (x2, a0, a1) = if centred { (1.0, scrim_amount * 0.82, scrim_amount * 0.82) } else { (1.0, scrim_amount, scrim_amount * 0.3) };
            fframes::svgr!(<g>
                <defs><linearGradient id={gid.clone()} x1="0" y1="0" x2={x2} y2="0">
                    <stop offset="0" stop-color={bg.clone()} stop-opacity={a0} />
                    <stop offset="0.62" stop-color={bg.clone()} stop-opacity={(a0 + a1) / 2.0} />
                    <stop offset="1" stop-color={bg} stop-opacity={a1} />
                </linearGradient></defs>
                <rect x={box_.x} y={box_.y} width={box_.w} height={box_.h} fill={format!("url(#{gid})")} />
            </g>)
        } else { fframes::svgr!(<g />) };
        let seam = match side {
            "left" => rect(box_.x + box_.w * (1.0 - open) + box_.w * open - 6.0, 0.0, 6.0, h, &self.p.accent),
            "right" => rect(box_.x, 0.0, 6.0, h, &self.p.accent),
            "top" => rect(0.0, box_.y + box_.h - 6.0, w, 6.0, &self.p.accent),
            "bottom" => rect(0.0, box_.y, w, 6.0, &self.p.accent),
            _ => fframes::svgr!(<g />),
        };
        fframes::svgr!(<g>
            <defs><clipPath id={id.clone()}><rect x={clip_x} y={clip_y} width={clip_w.max(0.0)} height={clip_h.max(0.0)} /></clipPath></defs>
            <g clip-path={format!("url(#{id})")}><g transform={drift}>{img}</g>{scrim}</g>
            {seam}
        </g>)
    }

    /// Rounded, optionally drifting plate. `cover` fills the box and crops; otherwise the
    /// plate adopts the media's aspect ratio so nothing is cropped.
    fn plate(&self, video: bool, box_: Area, cover: bool, start: f32) -> (Svgr<'a>, Area) {
        let (image, w, h) = self.source(video);
        let frame = if cover { box_ } else { contain(box_, w, h) };
        let seconds = self.b.frames as f32 / self.f.fps as f32;
        let drift = if self.props().get("drift").and_then(Value::as_bool).unwrap_or(false) {
            1.0 + 0.06 * self.m.intensity.max(0.3) * motion::in_out_cubic(self.t / seconds.max(0.1))
        } else { 1.0 };
        let (cx, cy) = (frame.x + frame.w / 2.0, frame.y + frame.h / 2.0);
        let id = self.uid("plate");
        let radius = 24.0f32.min(frame.w / 8.0).min(frame.h / 8.0);
        let aspect = if cover { "xMidYMid slice" } else { "xMidYMid meet" };
        let body = fframes::svgr!(<g>
            <defs><clipPath id={id.clone()}><rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={radius} ry={radius} /></clipPath></defs>
            {rounded(frame.x, frame.y, frame.w, frame.h, radius, &self.p.surface)}
            <g clip-path={format!("url(#{id})")}>
                <g transform={format!("translate({cx} {cy}) scale({drift}) translate({} {})", -cx, -cy)}>
                    <image x={frame.x} y={frame.y} width={frame.w} height={frame.h} preserveAspectRatio={aspect} href={image} />
                </g>
            </g>
            <rect x={frame.x + 0.75} y={frame.y + 0.75} width={frame.w - 1.5} height={frame.h - 1.5} rx={radius} ry={radius} fill="none" stroke={self.p.line()} stroke-width="1.5" opacity="0.7" />
        </g>);
        (self.rise(body, start, 28.0), frame)
    }

    pub(super) fn media(&self, video: bool) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let caption = s(p, "caption");
        let caption_h = if caption.trim().is_empty() { 0.0 } else { 76.0 };
        let cover = s(p, "fit") == "cover";
        let (plate, frame) = self.plate(video, Area { h: a.h - caption_h, ..a }, cover, self.b.cue_seconds - 0.25);
        let (label, _) = self.kicker(s(p, "label"), frame.x, frame.y - 46.0, frame.w.max(320.0), self.b.cue_seconds);
        let (caption, _) = self.para(caption, Area { x: frame.x, y: frame.y + frame.h + 22.0, w: frame.w.max(a.w * 0.5), h: caption_h - 10.0 }, Style::text(28.0), &self.p.muted, Align::Left);
        fframes::svgr!(<g>{label}{plate}{self.rise(caption, self.b.cue_seconds + 0.2, 8.0)}</g>)
    }

    /// Numbered pins on a screenshot with a matching legend and an optional focus region.
    pub(super) fn annotate(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let pins = arr(p, "pins");
        let cue = self.b.cue_seconds;
        let caption = s(p, "caption");
        let caption_h = if caption.trim().is_empty() { 0.0 } else { 64.0 };
        let (image_box, legend) = if self.wide {
            (Area { w: a.w * 0.6, h: a.h - caption_h, ..a }, Area { x: a.x + a.w * 0.6 + 64.0, y: a.y, w: a.w * 0.4 - 64.0, h: a.h })
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
                let (fx, fy) = (frame.x + n(focus, "x", 0.0) as f32 * frame.w, frame.y + n(focus, "y", 0.0) as f32 * frame.h);
                let (fw, fh) = (n(focus, "w", 1.0) as f32 * frame.w, n(focus, "h", 1.0) as f32 * frame.h);
                let dim = format!("M {} {} h {} v {} h {} Z M {fx} {fy} v {fh} h {fw} v {} Z",
                    frame.x, frame.y, frame.w, frame.h, -frame.w, -fh);
                overlay.push(fframes::svgr!(<g>
                    <path d={dim} fill={self.p.bg.clone()} fill-rule="evenodd" opacity={0.64 * e} />
                    <rect x={fx} y={fy} width={fw} height={fh} rx="12" ry="12" fill="none" stroke={self.p.accent.clone()} stroke-width="4" opacity={e} />
                </g>));
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
            let marker = fframes::svgr!(<g>
                <circle cx={px} cy={py} r={26.0 + 22.0 * pulse} fill={self.p.accent.clone()} opacity={0.25 * pulse} />
                <circle cx={px} cy={py} r="26" fill={self.p.accent.clone()} stroke={self.p.bg.clone()} stroke-width="4" />
                {self.run(number.clone(), px - w / 2.0, py + size * 0.36, Font::DisplayBold, size, 0.0, &self.p.bg)}
            </g>);
            overlay.push(self.pop(marker, time, px, py));
            let y = legend_top + i as f32 * row_h;
            let chip = fframes::svgr!(<g>
                <circle cx={legend.x + 20.0} cy={y + 24.0} r="20" fill={self.p.accent.clone()} />
                {self.run(number, legend.x + 20.0 - text::measure(Font::DisplayBold, &format!("{}", i + 1), 22.0, 0.0) / 2.0, y + 32.0, Font::DisplayBold, 22.0, 0.0, &self.p.bg)}
            </g>);
            let tx = legend.x + 62.0;
            let tw = legend.w - 62.0;
            let label = self.fit(s(pin, "label"), Style::display(Font::Display, if self.wide { 36.0 } else { 34.0 }), tw, row_h * 0.46);
            let (detail, _) = self.para(s(pin, "detail"), Area { x: tx, y: y + label.height() + 6.0, w: tw, h: (row_h - label.height() - 18.0).max(0.0) }, Style::text(26.0), &self.p.muted, Align::Left);
            let row = fframes::svgr!(<g>{chip}{self.draw(&label, tx, y + 24.0 - label.baseline + label.size * 0.36, tw, Align::Left, &self.p.ink)}{detail}</g>);
            rows.push(self.rise(row, time + 0.05, 14.0));
        }
        let (caption, _) = self.para(caption, Area { x: frame.x, y: frame.y + frame.h + 18.0, w: frame.w.max(image_box.w * 0.8), h: caption_h - 8.0 }, Style::text(24.0), &self.p.muted, Align::Left);
        let (label, _) = self.kicker(s(p, "label"), frame.x, frame.y - 46.0, frame.w.max(320.0), cue);
        fframes::svgr!(<g>{label}{plate}{overlay}{rows}{caption}</g>)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn media_offset_seeks_source_without_delaying_scene_or_global_clock() {
        let scene = Frame::new(15, 315, 30);
        let media = media_frame_at(&scene, 2.0);
        assert_eq!(media.index, 75); assert_eq!(media.global_index, 315); assert_eq!(media.fps, 30);
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
