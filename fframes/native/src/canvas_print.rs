//! Print: shapes and pictures printed the way posters, comics and newspapers were. A screen
//! turns tone into ink: halftone dots, or engraved lines that swell where the tone darkens.
//! The colour plate can sit a little off register from its key line, and worn ink lets the
//! paper through in specks. On a shape the tone is authored (flat, or a ramp along an axis);
//! on a picture each cell takes the darkness of the pixels beneath it. Geometry depends only
//! on the element (and a picture's decoded pixels) and is cached, so a printed scene costs
//! about as much per frame as a flat one. Nothing here reads the clock.
use super::*;
use std::sync::{Arc, OnceLock};

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum Screen {
    None,
    Dots,
    Lines,
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct Spec {
    pub screen: Screen,
    /// Screen pitch: dot or line spacing in canvas units.
    pub cell: f32,
    /// Screen angle in degrees (the direction lines run; the lattice turn for dots).
    pub angle: f32,
    /// Ink coverage 0–1: along `axis` from start to end on a shape, from light to dark on a
    /// picture. `None` takes the default for the surface.
    pub tone: Option<(f32, f32)>,
    pub axis: f32,
    /// Offset of the colour plate from the key line (the stroke).
    pub register: (f32, f32),
    pub wear: f32,
    pub ink: Option<Value>,
}

const KEYS: &[&str] = &["screen", "cell", "angle", "tone", "axis", "register", "wear", "ink"];

impl Spec {
    /// A named finish (benday, halftone, engraving, newsprint, letterpress: each the look
    /// of one printing process, mirrored by `PRINTS` in canvas.mjs) or an object.
    pub(crate) fn parse(v: &Value) -> Option<Spec> {
        let preset = |screen, cell, angle, tone, register, wear| Spec {
            screen,
            cell,
            angle,
            tone,
            axis: 90.0,
            register,
            wear,
            ink: None,
        };
        match v {
            Value::String(name) => Some(match name.as_str() {
                // Comic tints: a fine, flat dot screen at 15°.
                "benday" => preset(Screen::Dots, 10.0, 15.0, Some((0.3, 0.3)), (0.0, 0.0), 0.0),
                // A newspaper screen at 45°, light at the top and dark at the bottom.
                "halftone" => preset(Screen::Dots, 12.0, 45.0, None, (0.0, 0.0), 0.0),
                // Banknote and woodcut lines that swell with the tone.
                "engraving" => preset(Screen::Lines, 7.0, -28.0, None, (0.0, 0.0), 0.0),
                // The 1938 comic cover: Ben-Day tint, colour off register, worn newsprint.
                "newsprint" => preset(Screen::Dots, 9.0, 15.0, Some((0.28, 0.28)), (5.0, 3.5), 0.22),
                // Wood type and a two-colour bill: no screen, plates apart, ink dropping out.
                "letterpress" => preset(Screen::None, 10.0, 0.0, None, (7.0, -4.5), 0.35),
                _ => return None,
            }),
            Value::Object(o) => {
                if !o.keys().all(|k| KEYS.contains(&k.as_str())) {
                    return None;
                }
                let screen = match o.get("screen").map(|s| s.as_str()) {
                    None | Some(Some("none")) | Some(Some("")) => Screen::None,
                    Some(Some("dots")) => Screen::Dots,
                    Some(Some("lines")) => Screen::Lines,
                    _ => return None,
                };
                let number = |key: &str| o.get(key).map(|v| v.as_f64().map(|x| x as f32));
                let unit = |x: f64| (0.0..=1.0).contains(&x).then_some(x as f32);
                let tone = match o.get("tone") {
                    None => None,
                    Some(Value::Number(t)) => Some(unit(t.as_f64()?).map(|t| (t, t))?),
                    Some(Value::Array(a)) if a.len() == 2 => {
                        Some((unit(a[0].as_f64()?)?, unit(a[1].as_f64()?)?))
                    }
                    _ => return None,
                };
                let register = match o.get("register") {
                    None => (0.0, 0.0),
                    Some(Value::Array(a)) if a.len() == 2 => (a[0].as_f64()? as f32, a[1].as_f64()? as f32),
                    _ => return None,
                };
                if register.0.abs() > 60.0 || register.1.abs() > 60.0 {
                    return None;
                }
                let cell = match number("cell") {
                    None => 10.0,
                    Some(Some(c)) if (2.0..=160.0).contains(&c) => c,
                    _ => return None,
                };
                let wear = match number("wear") {
                    None => 0.0,
                    Some(Some(w)) if (0.0..=1.0).contains(&w) => w,
                    _ => return None,
                };
                let angle = match number("angle") {
                    None => {
                        if screen == Screen::Lines {
                            -28.0
                        } else {
                            45.0
                        }
                    }
                    Some(Some(a)) => a,
                    _ => return None,
                };
                let axis = match number("axis") {
                    None => 90.0,
                    Some(Some(a)) => a,
                    _ => return None,
                };
                let ink = o.get("ink").cloned();
                if ink.as_ref().is_some_and(|i| !i.is_string() || !paint_ok(Some(i))) {
                    return None;
                }
                Some(Spec { screen, cell, angle, tone, axis, register, wear, ink })
            }
            _ => None,
        }
    }

    /// Ink coverage (0–1) at `u`: a position along the tone axis on a shape, or a darkness
    /// on a picture.
    fn coverage(&self, u: f32, picture: bool) -> f32 {
        let (a, b) = self.tone.unwrap_or(if picture { (0.0, 0.9) } else { (0.12, 0.62) });
        (a + (b - a) * u.clamp(0.0, 1.0)).clamp(0.0, 1.0)
    }

    fn key(&self) -> u64 {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        format!("{self:?}").hash(&mut h);
        h.finish()
    }
}

pub(super) fn ok(v: &Value) -> bool {
    Spec::parse(v).is_some()
}

/// A laid screen: one path of dots, or line pieces bucketed by width.
pub(crate) struct Ink {
    dots: String,
    lines: Vec<(f32, String)>,
}

fn cache() -> &'static Mutex<HashMap<u64, Arc<Ink>>> {
    static CACHE: OnceLock<Mutex<HashMap<u64, Arc<Ink>>>> = OnceLock::new();
    CACHE.get_or_init(Default::default)
}

fn cached(key: Option<u64>, make: impl FnOnce() -> Ink) -> Arc<Ink> {
    if let Some(k) = key {
        if let Some(hit) = cache().lock().unwrap().get(&k) {
            return hit.clone();
        }
    }
    let ink = Arc::new(make());
    if let Some(k) = key {
        let mut map = cache().lock().unwrap();
        if map.len() > 256 {
            map.clear();
        }
        map.insert(k, ink.clone());
    }
    ink
}

/// At most this many dots or line pieces in one screen: a huge shape gets a coarser screen
/// rather than a slow frame.
const MAX_MARKS: f32 = 36_000.0;
/// Line widths are quantized to this many steps, one path each.
const LINE_STEPS: f32 = 12.0;

/// Lay a screen over closed `contours`. The lattice is anchored at the canvas origin, so two
/// shapes printed with the same screen share it, as plates on one sheet do. `coverage(x, y)`
/// gives the ink (0–1) wanted at a point.
fn lay(spec: &Spec, contours: &[(Vec<(f32, f32)>, bool)], coverage: impl Fn(f32, f32) -> f32) -> Ink {
    let pts = contours.iter().filter(|(_, c)| *c).flat_map(|(c, _)| c.iter().copied());
    let (mut x0, mut y0, mut x1, mut y1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
    for (x, y) in pts {
        (x0, y0, x1, y1) = (x0.min(x), y0.min(y), x1.max(x), y1.max(y));
    }
    let mut ink = Ink { dots: String::new(), lines: vec![] };
    if x0 >= x1 || y0 >= y1 {
        return ink;
    }
    let area = (x1 - x0) * (y1 - y0);
    let cell = spec.cell.max((area / MAX_MARKS).sqrt());
    let a = spec.angle.to_radians();
    let (d, nrm) = ((a.cos(), a.sin()), (-a.sin(), a.cos()));
    let project = |v: (f32, f32), x: f32, y: f32| v.0 * x + v.1 * y;
    let corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)];
    let span = |v: (f32, f32)| {
        corners.iter().fold((f32::MAX, f32::MIN), |(lo, hi), &(x, y)| (lo.min(project(v, x, y)), hi.max(project(v, x, y))))
    };
    let (v0, v1) = span(nrm);
    // Inside intervals (in t along `d`) of the row at offset `v`.
    let row = |v: f32| -> Vec<(f32, f32)> {
        effects::scanline(contours, (nrm.0 * v, nrm.1 * v), d)
            .into_iter()
            .map(|[p, q]| (project(d, p.0, p.1), project(d, q.0, q.1)))
            .collect()
    };
    let at = |v: f32, t: f32| (nrm.0 * v + d.0 * t, nrm.1 * v + d.1 * t);
    let mut buckets: Vec<String> = vec![String::new(); LINE_STEPS as usize + 1];
    for k in (v0 / cell).floor() as i32 - 1..=(v1 / cell).ceil() as i32 + 1 {
        let v = k as f32 * cell;
        match spec.screen {
            Screen::Dots => {
                // Rows half a cell either side catch dots whose centres fall just outside the
                // shape but whose ink reaches in; the clip trims them to the edge.
                let mut spans: Vec<(f32, f32)> =
                    [v - cell * 0.5, v, v + cell * 0.5].iter().flat_map(|&o| row(o)).collect();
                spans.sort_by(|a, b| a.0.total_cmp(&b.0));
                let mut merged: Vec<(f32, f32)> = vec![];
                for (s, e) in spans {
                    let (s, e) = (s - cell * 0.5, e + cell * 0.5);
                    match merged.last_mut() {
                        Some(last) if s <= last.1 => last.1 = last.1.max(e),
                        _ => merged.push((s, e)),
                    }
                }
                for (s, e) in merged {
                    for m in (s / cell).ceil() as i32..=(e / cell).floor() as i32 {
                        let (x, y) = at(v, m as f32 * cell);
                        let c = coverage(x, y);
                        // Area coverage until the dots touch, then they grow into one another
                        // until the paper between them closes.
                        let r = if c <= 0.785 {
                            cell * (c / PI).sqrt()
                        } else {
                            cell * (0.5 + (c - 0.785) / 0.215 * 0.21)
                        };
                        if r < 0.3 {
                            continue;
                        }
                        ink.dots.push_str(&format!(
                            "M{:.1} {:.1}a{r:.2} {r:.2} 0 1 0 {:.2} 0a{r:.2} {r:.2} 0 1 0 {:.2} 0Z",
                            x - r,
                            y,
                            2.0 * r,
                            -2.0 * r
                        ));
                    }
                }
            }
            Screen::Lines => {
                // Each line is cut into short pieces whose width follows the tone at their
                // middle, so it swells and thins like a burin cut.
                let piece = cell * 1.25;
                for (s, e) in row(v) {
                    let n = ((e - s) / piece).ceil().max(1.0) as usize;
                    let len = (e - s) / n as f32;
                    for i in 0..n {
                        let (ta, tb) = (s + i as f32 * len, s + (i + 1) as f32 * len);
                        let (mx, my) = at(v, (ta + tb) / 2.0);
                        let step = (coverage(mx, my) * LINE_STEPS).round() as usize;
                        if step == 0 {
                            continue;
                        }
                        let ((ax, ay), (bx, by)) = (at(v, ta), at(v, tb));
                        buckets[step.min(LINE_STEPS as usize)]
                            .push_str(&format!("M{ax:.1} {ay:.1}L{bx:.1} {by:.1}"));
                    }
                }
            }
            Screen::None => {}
        }
    }
    ink.lines = buckets
        .into_iter()
        .enumerate()
        .filter(|(_, d)| !d.is_empty())
        .map(|(step, d)| (cell * step as f32 / LINE_STEPS * 0.96, d))
        .collect();
    ink
}

/// Darkness (0 paper, 1 solid ink) of a decoded picture around pixel (u, v), averaged over a
/// box `half` pixels either side so the screen describes the area a dot stands for.
fn darkness(img: &fframes::usvgr::PreloadedImageData, u: f32, v: f32, half: f32) -> f32 {
    let (w, h) = (img.width as i64, img.height as i64);
    if w == 0 || h == 0 {
        return 0.0;
    }
    let taps: &[f32] = if half < 1.0 { &[0.0] } else { &[-0.66, 0.0, 0.66] };
    let (mut sum, mut count) = (0.0, 0.0);
    for &dy in taps {
        for &dx in taps {
            let x = ((u + dx * half) as i64).clamp(0, w - 1);
            let y = ((v + dy * half) as i64).clamp(0, h - 1);
            let i = ((y * w + x) * 4) as usize;
            let Some(px) = img.data.get(i..i + 4) else { continue };
            let a = px[3] as f32 / 255.0;
            let lum = (0.2126 * px[0] as f32 + 0.7152 * px[1] as f32 + 0.0722 * px[2] as f32) / 255.0;
            // Colours are blended with their alpha already; transparent pixels are paper.
            sum += (a - lum).max(0.0);
            count += 1.0;
        }
    }
    if count > 0.0 { sum / count } else { 0.0 }
}

fn rect_contour(x: f32, y: f32, w: f32, h: f32) -> Vec<(Vec<(f32, f32)>, bool)> {
    vec![(vec![(x, y), (x + w, y), (x + w, y + h), (x, y + h), (x, y)], true)]
}

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    fn ink_nodes(&self, ink: &Ink, color: &str, opacity: f32) -> Vec<Svgr<'a>> {
        let mut nodes = vec![];
        if !ink.dots.is_empty() {
            nodes.push(fframes::svgr!(<path d={ink.dots.clone()} fill={color.to_owned()} opacity={opacity} />));
        }
        for (width, d) in &ink.lines {
            nodes.push(fframes::svgr!(<path d={d.clone()} fill="none" stroke={color.to_owned()} stroke-width={*width} stroke-linecap="butt" opacity={opacity} />));
        }
        nodes
    }

    /// A shape printed in two plates: its fill and screen (the colour plate), offset by
    /// `register`, under its stroke (the key plate) on register; worn if asked.
    #[allow(clippy::too_many_arguments)]
    pub(super) fn printed(
        &self,
        el: &Value,
        spec: &Spec,
        draw: f32,
        dash_shift: f32,
        reveal: f32,
        local: f32,
        defs: &mut Vec<Svgr<'a>>,
        now: f32,
    ) -> Svgr<'a> {
        let plain = |fill: Option<&str>, stroke: Option<&str>| {
            let mut v = el.clone();
            if let Some(o) = v.as_object_mut() {
                o.remove("print");
                if let Some(c) = fill {
                    o.insert("fill".into(), Value::String(c.into()));
                }
                if let Some(c) = stroke {
                    o.insert("stroke".into(), Value::String(c.into()));
                }
            }
            v
        };
        let stroked = el.get("stroke").is_some_and(|v| v != "none");
        let colour = self.shape(&plain(None, Some("none")), draw, dash_shift, reveal, local, defs, now);
        let contours = contours_of(el);
        let closed = contours.iter().any(|(_, c)| *c);
        let screen = if spec.screen != Screen::None && closed {
            let (bx, by, bw, bh) = bounds(el);
            let a = spec.axis.to_radians();
            let (ax, ay) = (a.cos(), a.sin());
            let reach = (bw * ax.abs() + bh * ay.abs()).max(1.0);
            let (cx, cy) = (bx + bw / 2.0, by + bh / 2.0);
            let key = {
                use std::hash::{Hash, Hasher};
                let mut h = std::collections::hash_map::DefaultHasher::new();
                (spec.key(), s(el, "type"), el.get("d").map(Value::to_string), el.get("points").map(Value::to_string))
                    .hash(&mut h);
                for k in ["x", "y", "w", "h", "r", "cx", "cy", "rx", "ry"] {
                    f(el, k, 0.0).to_bits().hash(&mut h);
                }
                h.finish()
            };
            let ink = cached(Some(key), || {
                lay(spec, &contours, |x, y| spec.coverage(((x - cx) * ax + (y - cy) * ay) / reach + 0.5, false))
            });
            let color = self.paint(spec.ink.as_ref(), "ink", defs);
            let alpha = if draw < 0.999 { motion::clamp01((draw - 0.55) / 0.45) } else { 1.0 };
            let id = self.uid("print");
            let outline: String = contours
                .iter()
                .filter(|(_, c)| *c)
                .map(|(c, _)| {
                    c.iter()
                        .enumerate()
                        .map(|(i, p)| format!("{}{:.1} {:.1}", if i == 0 { "M" } else { "L" }, p.0, p.1))
                        .collect::<String>()
                        + "Z"
                })
                .collect();
            let nodes = self.ink_nodes(&ink, &color, alpha);
            fframes::svgr!(<g>
                <defs><clipPath id={id.clone()}><path d={outline} /></clipPath></defs>
                <g clip-path={format!("url(#{id})")}>{nodes}</g>
            </g>)
        } else {
            fframes::svgr!(<g />)
        };
        let key = if stroked {
            self.shape(&plain(Some("none"), None), draw, dash_shift, reveal, local, defs, now)
        } else {
            fframes::svgr!(<g />)
        };
        let (dx, dy) = spec.register;
        fframes::svgr!(<g>
            <g transform={format!("translate({dx} {dy})")}>{colour}{screen}</g>
            {key}
        </g>)
    }

    /// A picture printed through a screen: paper, then ink whose dots or lines follow the
    /// darkness of the pixels beneath them. `place` is where the picture lies (x, y, w, h) and
    /// `region` the part that shows. `keep` caches the screen (stills; not footage frames).
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn printed_picture(
        &self,
        img: &fframes::usvgr::PreloadedImageData,
        place: (f32, f32, f32, f32),
        region: (f32, f32, f32, f32),
        spec: &Spec,
        paper: &str,
        ink: &str,
        keep: bool,
    ) -> Svgr<'a> {
        let (px, py, pw, ph) = place;
        let (iw, ih) = (img.width.max(1) as f32, img.height.max(1) as f32);
        let (sx, sy) = (iw / pw.max(1.0), ih / ph.max(1.0));
        // The visible part of the picture, slightly enlarged so a drifting plate never shows
        // an unprinted edge.
        let (rx, ry, rw, rh) = region;
        let (gx, gy) = (rx.max(px) - 0.06 * rw, ry.max(py) - 0.06 * rh);
        let (gw, gh) = ((rx + rw).min(px + pw) - gx + 0.06 * rw, (ry + rh).min(py + ph) - gy + 0.06 * rh);
        let key = keep.then(|| {
            use std::hash::{Hash, Hasher};
            let mut h = std::collections::hash_map::DefaultHasher::new();
            (spec.key(), &img.id, img.width, img.height).hash(&mut h);
            for v in [px, py, pw, ph, gx, gy, gw, gh] {
                v.to_bits().hash(&mut h);
            }
            h.finish()
        });
        let half = spec.cell * 0.5 * sx.max(sy);
        let screen = cached(key, || {
            lay(spec, &rect_contour(gx, gy, gw.max(1.0), gh.max(1.0)), |x, y| {
                spec.coverage(darkness(img, (x - px) * sx, (y - py) * sy, half), true)
            })
        });
        let nodes = self.ink_nodes(&screen, ink, 1.0);
        let ground = if paper == "none" {
            fframes::svgr!(<g />)
        } else {
            fframes::svgr!(<rect x={gx} y={gy} width={gw.max(0.0)} height={gh.max(0.0)} fill={paper.to_owned()} />)
        };
        fframes::svgr!(<g>{ground}{nodes}</g>)
    }

    /// Worn ink: the paper shows through in seeded specks, as on a hand-inked block or a
    /// tired newspaper press. Static for the element, like a real impression.
    pub(super) fn worn(&self, shape: Svgr<'a>, wear: f32, seed: u64, (bx, by, bw, bh): (f32, f32, f32, f32)) -> Svgr<'a> {
        if wear <= 0.0 {
            return shape;
        }
        let id = self.uid("wear");
        let pad = 24.0 + 0.05 * bw.max(bh);
        // Fine grain decides where a speck opens; a broad, slow field decides where the
        // press ran dry, so specks gather in patches instead of spreading evenly like static.
        // A steep ramp turns the high points into paper.
        let threshold = 0.76 - 0.2 * wear;
        let slope = 18.0;
        let matrix = format!("0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  {} 0 0 0 {}", -slope, 1.0 + slope * threshold);
        let seed = (seed % 997) as f32;
        fframes::svgr!(<g>
            <defs><filter id={id.clone()} filterUnits="userSpaceOnUse" x={bx - pad} y={by - pad} width={bw + 2.0 * pad} height={bh + 2.0 * pad} color-interpolation-filters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="4" seed={seed} result="grain0" />
                <feColorMatrix in="grain0" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="grain" />
                <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="2" seed={seed + 1.0} result="dry0" />
                <feColorMatrix in="dry0" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="dry" />
                <feComposite in="grain" in2="dry" operator="arithmetic" k1="0" k2="0.62" k3="0.62" k4="-0.12" result="speck" />
                <feColorMatrix in="speck" type="matrix" values={matrix} result="keep" />
                <feComposite in="SourceGraphic" in2="keep" operator="in" />
            </filter></defs>
            <g filter={format!("url(#{id})")}>{shape}</g>
        </g>)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presets_and_objects_parse_and_garbage_does_not() {
        for name in ["benday", "halftone", "engraving", "newsprint", "letterpress"] {
            assert!(Spec::parse(&serde_json::json!(name)).is_some(), "{name}");
        }
        assert_eq!(Spec::parse(&serde_json::json!("newsprint")).unwrap().register, (5.0, 3.5));
        let s = Spec::parse(&serde_json::json!({"screen": "lines", "tone": [0.1, 0.7], "ink": "accent"})).unwrap();
        assert_eq!((s.screen, s.angle, s.tone), (Screen::Lines, -28.0, Some((0.1, 0.7))));
        for bad in [
            serde_json::json!("woodcut"),
            serde_json::json!({"screen": "stars"}),
            serde_json::json!({"tone": 1.5}),
            serde_json::json!({"register": [1]}),
            serde_json::json!({"cell": 0.5}),
            serde_json::json!({"ink": "chartreuse"}),
            serde_json::json!({"wobble": 1}),
        ] {
            assert!(Spec::parse(&bad).is_none(), "{bad}");
        }
    }

    #[test]
    fn a_screen_follows_the_tone_and_stays_inside_the_shape() {
        let square = rect_contour(0.0, 0.0, 200.0, 200.0);
        let flat = |c: f32| {
            let spec = Spec { tone: Some((c, c)), ..Spec::parse(&serde_json::json!("halftone")).unwrap() };
            lay(&spec, &square, |_, _| spec.coverage(0.0, false))
        };
        let count = |ink: &Ink| ink.dots.matches('Z').count();
        let (light, dark) = (flat(0.1), flat(0.6));
        assert_eq!(count(&light), count(&dark), "one dot per cell, whatever the tone");
        let radius = |ink: &Ink| ink.dots.split('a').nth(1).unwrap().split(' ').next().unwrap().parse::<f32>().unwrap();
        assert!(radius(&dark) > radius(&light) * 2.0);
        // Every dot lies within a cell of the square (the clip trims the edge ones).
        for m in light.dots.split('M').skip(1) {
            let mut it = m.split(['a', ' ']);
            let (x, y) = (it.next().unwrap().parse::<f32>().unwrap(), it.next().unwrap().parse::<f32>().unwrap());
            assert!((-16.0..=212.0).contains(&x) && (-12.0..=212.0).contains(&y), "{x},{y}");
        }
        assert!(flat(0.0).dots.is_empty(), "no ink, no dots");
        let lines = Spec::parse(&serde_json::json!({"screen": "lines", "tone": [0.0, 1.0]})).unwrap();
        let cut = lay(&lines, &square, |_, y| lines.coverage(y / 200.0, false));
        assert!(cut.lines.len() > 6, "lines swell through many widths");
    }
}
