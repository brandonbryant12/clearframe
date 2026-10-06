//! The scene compositor: layout areas (including split plates), the camera, the plate and tone
//! layers, entrances and exits, and the graphic transitions that span a cut.
use super::*;
use skia_safe::{Matrix, Rect, TileMode, image_filters};

const HERO: [&str; 3] = ["title", "statement", "endcard"];

/// Where a plate sits; tall frames stack left/right plates on top/bottom.
pub(crate) fn plate_side(plate: &Value, tall: bool) -> &str {
    match (nonempty(s(plate, "side"), "full"), tall) {
        ("left", true) => "top",
        ("right", true) => "bottom",
        ("top", false) => "left",
        ("bottom", false) => "right",
        (side, _) => side,
    }
}

pub fn render(b: &Beat, frame: Frame, ctx: &Ctx) -> Node {
    let env = &b.environment;
    let wide = env.width / env.height > 1.3;
    let tall = env.height > env.width;
    let x = if wide { 120.0 } else { 86.0 };
    let bottom = if env.captions { if tall { 365.0 } else { 215.0 } } else { 145.0 };
    let hero = HERO.contains(&b.block.as_str()) || matches!(b.block.as_str(), "chapter" | "highlight");
    let portrait_shift = if tall { env.height * 0.11 - 108.0 } else { 0.0 };
    let headless = s(&b.props, "title").trim().is_empty() && s(&b.props, "kicker").trim().is_empty();
    // A bottom heading gives the picture the top of the frame and reserves a lower third.
    let low = !hero && !headless && b.heading == "bottom";
    let top = if hero {
        235.0 + portrait_shift
    } else if low || (headless && matches!(b.block.as_str(), "image" | "video" | "annotate" | "kinetic" | "canvas")) {
        200.0 + portrait_shift
    } else {
        335.0 + portrait_shift
    };
    let reserve = if low { 176.0 + if s(&b.props, "kicker").trim().is_empty() { 0.0 } else { 40.0 } } else { 0.0 };
    // Letterbox bars take the top and bottom of the frame: headings, content and the
    // source line move inside the picture so nothing important sits under a bar.
    let bar = crate::lens::bar(crate::lens::Lens::from(&b.lens).letterbox, env.width, env.height);
    // Headings move below the bar; hero scenes already sit clear of it unless it is tall.
    let (lift, drop) = ((bar - 50.0).max(0.0), (bar - 30.0).max(0.0));
    let (top, bottom) = (top + if hero { (bar + 60.0 - top).max(0.0) } else { lift }, bottom + drop);
    let mut area = Area { x, y: top, w: env.width - x * 2.0, h: env.height - top - bottom - reserve };
    let (mut head_y, mut floor) = (None, env.height - drop);
    // Split plates hand the block the other side of the frame.
    let side = b.plate.as_ref().map_or("none", |p| plate_side(p, tall));
    match side {
        "left" => {
            let edge = env.width * 0.46;
            area.x = edge + 96.0;
            area.w = env.width - area.x - 110.0;
        }
        "right" => {
            let edge = env.width * 0.54;
            area.w = edge - 96.0 - area.x;
        }
        "top" => {
            let edge = env.height * 0.4;
            head_y = Some(edge + 64.0);
            let shift = edge + 64.0 - 100.0;
            area.y = if hero { edge + 150.0 } else { 335.0 + shift - if headless { 135.0 } else { 0.0 } };
            area.h = env.height - area.y - bottom;
        }
        "bottom" => {
            let edge = env.height * 0.6;
            floor = edge;
            area.h = (edge - 70.0 - area.y).max(120.0);
        }
        _ => {}
    }
    let mut d = Draw::new(b, frame, ctx, area);
    d.head_y = head_y;
    d.floor = floor;
    d.bar = bar;
    d.lift = lift;
    let plate = d.plate_layer(side);
    let header = if hero { empty() } else { d.header() };
    let body = match b.block.as_str() {
        "title" | "statement" | "endcard" => d.hero(),
        "chapter" => d.chapter(),
        "highlight" => d.highlight(),
        "stat" => d.stat(),
        "kpis" => d.kpis(),
        "delta" => d.delta(),
        "bars" => d.bars(),
        "line" => d.line(),
        "waffle" => d.waffle(),
        "ring" => d.ring(),
        "donut" => d.donut(),
        "funnel" => d.funnel(),
        "magnitude" => d.magnitude(),
        "compare" => d.compare(),
        "matrix" => d.matrix(),
        "quote" => d.quote(),
        "list" => d.list(),
        "equation" => d.equation(),
        "callout" => d.callout(),
        "steps" => d.steps(),
        "timeline" => d.timeline(),
        "checklist" => d.checklist(),
        "icon-grid" => d.icon_grid(),
        "flow" => d.flow(),
        "cycle" => d.cycle(),
        "breathing" => d.breathing(),
        "image" => d.media(false),
        "video" => d.media(true),
        "annotate" => d.annotate(),
        "kinetic" => d.kinetic(),
        "canvas" => d.canvas(),
        "stage" => empty(),
        _ => panic!("unsupported block {}", b.block),
    };
    // A push to a detail moves the picture only: the heading and source stay readable.
    let picture = push_to(&d, draw::group(vec![d.art("under").into(), body.into(), d.art("over").into()]));
    // The heading leaves as the camera moves in, as a title card does.
    let header = match push_progress(&d) {
        Some(q) if q > 0.0 => draw::group(vec![header.into()]).opacity((1.0 - 2.0 * q).max(0.0)),
        _ => header,
    };
    let content = draw::group(vec![header.into(), picture.into()]);
    let footer = d.footer();
    scene_motion(&d, plate, content, footer)
}

/// `camera: {to: [x, y, w, h], at, dur}`: from the full frame into a frame-pixel rect, at a
/// constant pace in zoom (a close-up on the bar, the word or the part that matters), then a
/// slow drift in so the close-up keeps breathing.
/// Progress 0–1 of a push to a detail (None when the beat has none).
fn push_progress(d: &Draw<'_, '_>) -> Option<f32> {
    let spec = d.b.camera.as_ref().filter(|c| arr(c, "to").len() == 4)?;
    let (at, dur) = (n(spec, "at", 0.6) as f32, (n(spec, "dur", 1.4) as f32).max(0.05));
    Some(motion::in_out_cubic(motion::clamp01((d.t - at) / dur)))
}

fn push_to<'a>(d: &Draw<'a, '_>, picture: Node) -> Node {
    let (Some(spec), Some(q)) = (d.b.camera.as_ref(), push_progress(d)) else { return picture };
    let to = arr(spec, "to");
    let env = &d.b.environment;
    let (w, h) = (env.width, env.height);
    let r: [f32; 4] = std::array::from_fn(|i| to[i].as_f64().unwrap_or(0.0) as f32);
    let (at, dur) = (n(spec, "at", 0.6) as f32, (n(spec, "dur", 1.4) as f32).max(0.05));
    let settle = motion::clamp01((d.t - at - dur) / 6.0);
    // Target zoom fits the rect in the frame; the zoom interpolates in log space.
    let k1 = (w / r[2]).min(h / r[3]) * (1.0 + 0.03 * settle);
    let k = k1.powf(q);
    let (cx, cy) = (w / 2.0 + (r[0] + r[2] / 2.0 - w / 2.0) * q, h / 2.0 + (r[1] + r[3] / 2.0 - h / 2.0) * q);
    if q <= 0.0 {
        return picture;
    }
    draw::group(vec![picture.into()]).translate(-cx, -cy).scale(k, k).translate(w / 2.0, h / 2.0)
}

/// A slow camera move across the whole scene keeps held frames alive. `auto` pushes in
/// gently on most blocks and holds still where reading must stay steady.
fn camera<'a>(d: &Draw<'a, '_>, body: Node) -> Node {
    let b = d.b;
    let spec = b.camera.as_ref();
    // A push to a detail replaces the slow move.
    if spec.is_some_and(|c| arr(c, "to").len() == 4) {
        return body;
    }
    let authored = spec.map(|c| nonempty(s(c, "move"), "auto")).unwrap_or("auto");
    let (kind, amount) = match authored {
        "auto" => {
            let still = matches!(b.block.as_str(), "kinetic" | "video" | "annotate" | "breathing");
            // Enough push to read as a living shot (about 2% over the beat), not a zoom.
            (if still { "none" } else { "in" }, 0.8 * d.m.intensity.max(0.35))
        }
        other => (other, spec.map_or(0.5, |c| n(c, "amount", 0.5) as f32)),
    };
    if kind == "none" || amount <= 0.0 {
        return body;
    }
    let env = &b.environment;
    let (w, h) = (env.width, env.height);
    let seconds = b.frames as f32 / d.f.fps as f32;
    let x = motion::in_out_cubic(d.t / seconds.max(0.1));
    let (cx, cy) = (w / 2.0, h / 2.0);
    match kind {
        "in" => body.scale_about(1.0 + 0.045 * amount * x, cx, cy),
        "out" => body.scale_about(1.0 + 0.045 * amount * (1.0 - x), cx, cy),
        "left" => body.translate(w * 0.025 * amount * (0.5 - x) * 2.0, 0.0),
        "right" => body.translate(-w * 0.025 * amount * (0.5 - x) * 2.0, 0.0),
        "up" => body.translate(0.0, h * 0.025 * amount * (0.5 - x) * 2.0),
        "down" => body.translate(0.0, -h * 0.025 * amount * (0.5 - x) * 2.0),
        _ => body,
    }
}

/// Colour and origin of a graphic transition (film palette tokens; origin 0–1).
fn cover_style(d: &Draw<'_, '_>, entering: bool) -> (String, String, (f32, f32)) {
    let style = if entering { d.b.enter_style.as_ref() } else { d.b.exit_style.as_ref() };
    let token = |name: &str, fallback: &str| -> String {
        let p = &d.base;
        match name {
            "accent" => p.accent.clone(),
            "accent2" => p.accent2.clone(),
            "ink" => p.ink.clone(),
            "bg" => p.bg.clone(),
            "surface" => p.surface.clone(),
            _ => fallback.to_owned(),
        }
    };
    let color = token(style.map_or("", |v| s(v, "color")), &d.base.accent);
    // The band/ring takes the other accent, or the accent when the cover is already accent2.
    let edge = if color == d.base.accent { d.base.accent2.clone() } else { d.base.accent.clone() };
    let origin = style
        .map(|v| arr(v, "origin"))
        .filter(|o| o.len() == 2)
        .map(|o| (o[0].as_f64().unwrap_or(0.5) as f32, o[1].as_f64().unwrap_or(0.5) as f32))
        .unwrap_or((0.5, 0.5));
    (color, edge, origin)
}

/// A frame-wide panel with a thin band on its leading edge.
fn panel<'a>(d: &Draw<'a, '_>, x: f32, leading_left: bool, entering: bool) -> Node {
    let env = &d.b.environment;
    let (w, h) = (env.width, env.height);
    let (color, edge, _) = cover_style(d, entering);
    let band = w * 0.055;
    let band_x = if leading_left { x - band } else { x + w };
    draw::group(vec![rect(x, 0.0, w, h, &color).into(), rect(band_x, 0.0, band, h, &edge).into()])
}

/// A colour field with a circular window of radius `r` around the transition origin.
fn iris<'a>(d: &Draw<'a, '_>, progress: f32, window: bool) -> Node {
    let env = &d.b.environment;
    let (w, h) = (env.width, env.height);
    let (color, edge, (ox, oy)) = cover_style(d, window);
    let (cx, cy) = (w * ox.clamp(0.0, 1.0), h * oy.clamp(0.0, 1.0));
    // Radius that reaches the farthest corner from the origin.
    let far = [(0.0, 0.0), (w, 0.0), (0.0, h), (w, h)]
        .iter()
        .map(|(x, y): &(f32, f32)| (x - cx).hypot(y - cy))
        .fold(0.0, f32::max);
    let r = progress * far + if window { 1.0 } else { 0.0 };
    let circle = format!("M {} {cy} a {r} {r} 0 1 0 {} 0 a {r} {r} 0 1 0 {} 0 Z", cx - r, 2.0 * r, -2.0 * r);
    if window {
        let d_path = format!("M 0 0 H {w} V {h} H 0 Z {circle}");
        draw::group(vec![
            draw::path(d_path).fill(color).even_odd().node(),
            draw::circle(cx, cy, r).stroke(edge, 14.0).node(),
        ])
    } else {
        draw::group(vec![draw::circle(cx, cy, r).fill(color).node(), draw::circle(cx, cy, r).stroke(edge, 14.0).node()])
    }
}

/// The scene-level entrance over the persistent backdrop, then the exit that mirrors the
/// next scene's entrance. Neither cross-dissolves two scenes; graphic transitions (panel,
/// iris, whip) are one movement split across the cut.
fn scene_motion<'a>(d: &Draw<'a, '_>, plate: Node, content: Node, footer: Node) -> Node {
    let part = super::PART.with(|p| p.get());
    let (plate, content, footer) = match part {
        1 => (plate, empty(), empty()),
        2 => (empty(), content, footer),
        _ => (plate, content, footer),
    };
    let b = d.b;
    let env = &b.environment;
    let (w, h) = (env.width, env.height);
    let content = camera(d, content);
    let enter = d.m.enter(d.t);
    let distance = d.m.distance(36.0);
    let reveal = motion::reveal_seconds(&b.transition);
    let reveal_p = if reveal > 0.0 { motion::out_cubic(d.t / reveal) } else { 1.0 };
    let mut blur = 0.0;
    let mut cover = empty();
    let none = Matrix::default();
    let (opacity, transform, clip) = match b.transition.as_str() {
        "fade" => (enter.alpha, none, w),
        "rise" => (enter.alpha, Matrix::translate((0.0, distance * (1.0 - enter.travel))), w),
        "push" => (1.0, Matrix::translate((w * (1.0 - motion::out_expo(d.t / (d.m.duration() + 0.15))), 0.0)), w),
        "zoom" => {
            let scale = 1.0 - 0.05 * d.m.intensity * (1.0 - enter.travel);
            (
                enter.alpha,
                Matrix::scale_translate((scale, scale), (w * (1.0 - scale) / 2.0, h * (1.0 - scale) / 2.0)),
                w,
            )
        }
        "wipe" => (1.0, none, w * motion::in_out_cubic(d.t / (d.m.duration() + 0.25))),
        "panel" => {
            if reveal_p < 1.0 {
                cover = panel(d, -w * reveal_p, false, true);
            }
            (1.0, none, w)
        }
        "iris" => {
            if reveal_p < 1.0 {
                cover = iris(d, reveal_p, true);
            }
            (1.0, none, w)
        }
        "whip" => {
            blur = 24.0 * (1.0 - reveal_p);
            (1.0, Matrix::translate((w * 0.22 * (1.0 - reveal_p), 0.0)), w)
        }
        // A trailer's flash cut: a few frames of white light, gone before the shot is read.
        "flash" => {
            let a = (1.0 - motion::clamp01(d.t / 0.22)).powi(3);
            if a > 0.004 {
                cover = draw::rect(0.0, 0.0, w, h).fill("#ffffff").opacity(a).node();
            }
            (1.0, none, w)
        }
        _ => (1.0, none, w),
    };
    let seconds = b.frames as f32 / d.f.fps as f32;
    let final_scene = env.index + 1 == env.total;
    let exit_kind = ExitKind::parse(&b.exit).unwrap_or(ExitKind::None);
    let exit_seconds = if final_scene {
        0.8
    } else {
        exit_kind.cover_seconds().unwrap_or(match d.m.preset {
            motion::Preset::Snappy => 0.22,
            motion::Preset::Spring => 0.36,
            motion::Preset::Gentle => 0.32,
        })
    };
    let last_word = b.words.last().map_or(0.0, |w| w.end);
    // Never leave while the entrance, a count or a staged item is still running.
    let earliest = last_word.max(d.m.duration() + 0.25).max(b.settle_seconds).max(reveal);
    let x = match exit_kind {
        ExitKind::None => 0.0,
        k if k.cover_seconds().is_some() && !final_scene => {
            motion::cover_progress(d.t, seconds, exit_seconds, earliest)
        }
        _ => motion::exit_progress(d.t, seconds, exit_seconds, earliest),
    };
    let mut exit_opacity = 1.0;
    let mut exit_transform = none;
    let mut exit_clip = (0.0, w);
    let mut exit_cover = empty();
    if x > 0.0 {
        match exit_kind {
            ExitKind::Fade => {
                exit_opacity = 1.0 - x;
                if !final_scene {
                    exit_transform = Matrix::translate((0.0, -d.m.distance(22.0) * x));
                }
            }
            ExitKind::Push => {
                exit_opacity = 1.0 - x * 0.6;
                exit_transform = Matrix::translate((-w * 0.35 * x, 0.0));
            }
            ExitKind::Zoom => {
                let scale = 1.0 + 0.04 * d.m.intensity.max(0.3) * x;
                exit_opacity = 1.0 - x;
                exit_transform =
                    Matrix::scale_translate((scale, scale), (w * (1.0 - scale) / 2.0, h * (1.0 - scale) / 2.0));
            }
            ExitKind::Wipe => {
                exit_clip = (w * x, w - w * x);
            }
            ExitKind::Panel => exit_cover = panel(d, w * (1.0 - x), true, false),
            ExitKind::Iris => exit_cover = iris(d, x, false),
            ExitKind::Whip => {
                exit_transform = Matrix::translate((-w * 0.22 * x, 0.0));
                blur = blur.max(38.0 * x);
            }
            ExitKind::None => {}
        }
        if final_scene && exit_kind.cover_seconds().is_some() {
            exit_opacity = 1.0 - x;
            exit_cover = empty();
            exit_transform = none;
        }
    }
    if clip <= 0.0 {
        return layer(footer, exit_opacity, exit_transform, None, h);
    }
    let tone = if part != 2 && b.tone.as_deref().is_some_and(|t| !t.is_empty() && t != "none") {
        rect(0.0, 0.0, w, h, &d.p.bg)
    } else {
        empty()
    };
    let content = layer(
        draw::group(vec![tone.into(), plate.into(), content.into()]),
        opacity,
        transform,
        (clip < w - 0.5).then_some((0.0, clip)),
        h,
    );
    let exit_clip = (exit_clip.0 > 0.5).then_some(exit_clip);
    let scene = layer(draw::group(vec![content.into(), footer.into()]), exit_opacity, exit_transform, exit_clip, h);
    // A whip is a horizontal motion blur on the moving scene only; the backdrop stays sharp.
    let scene = if blur > 0.3 {
        let filter = image_filters::blur((blur, 0.0), TileMode::Decal, None, None);
        scene.filter_in(filter, Rect::from_xywh(-w * 0.1, 0.0, w * 1.2, h))
    } else {
        scene
    };
    if part == 1 {
        return scene;
    }
    draw::group(vec![scene.into(), cover.into(), exit_cover.into()])
}

/// Wrap a layer in opacity/transform/clip groups only when they change anything.
fn layer(body: Node, opacity: f32, transform: Matrix, clip: Option<(f32, f32)>, h: f32) -> Node {
    let body = body.opacity(opacity.clamp(0.0, 1.0)).transform(transform);
    match clip {
        Some((x, width)) => body.clip_rect(x, 0.0, width.max(0.0), h),
        None => body,
    }
}
