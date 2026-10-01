//! The frame audit: what a director would send back, found in each converted frame. Text cut
//! by the frame edge or the letterbox, text printed over other text or over the subject, and
//! type too small to read. `check` fails on any error. Only text that is held on screen is
//! judged: type crossing the edge in a whip or a camera move is the move, not a mistake.
use fframes::usvgr::{self, Node};
use serde::Serialize;

/// Smallest type a viewer can read on a phone, in pixels of a 1080-line frame.
pub const MIN_PX: f32 = 20.0;
/// Below this, type is a texture, not text: an error.
pub const ILLEGIBLE_PX: f32 = 14.0;
/// Smaller than this, a world label far from the camera is detail, not text.
const DETAIL_PX: f32 = 5.0;

#[derive(Clone, Debug)]
pub struct Seen {
    pub text: String,
    pub rect: [f32; 4],
    pub opacity: f32,
    pub px: f32,
    /// Under a clip or mask: cut on purpose (a reveal, a framed image).
    pub masked: bool,
}

#[derive(Default, Debug)]
pub struct Scan {
    pub texts: Vec<Seen>,
    pub bars: Vec<[f32; 4]>,
    pub subjects: Vec<[f32; 4]>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Finding {
    pub level: &'static str,
    pub kind: &'static str,
    pub text: String,
    pub message: String,
}

fn rect(r: usvgr::Rect) -> [f32; 4] {
    [r.x(), r.y(), r.width(), r.height()]
}

pub fn scan(tree: &usvgr::Tree) -> Scan {
    let mut out = Scan::default();
    walk(tree.root(), 1.0, false, &mut out);
    out
}

fn walk(group: &usvgr::Group, opacity: f32, masked: bool, out: &mut Scan) {
    for node in group.children() {
        match node {
            Node::Group(g) => {
                let o = opacity * g.opacity().get();
                if o < 0.05 {
                    continue;
                }
                if g.id().starts_with("cf-bar") {
                    out.bars.push(rect(g.abs_bounding_box()));
                    continue;
                }
                if g.id().contains("-subject-") && o > 0.5 {
                    out.subjects.push(rect(g.abs_bounding_box()));
                }
                walk(g, o, masked || g.clip_path().is_some() || g.mask().is_some(), out);
            }
            Node::Text(t) => {
                let text = t.chunks().iter().map(|c| c.text()).collect::<Vec<_>>().join(" ");
                if text.trim().is_empty() {
                    continue;
                }
                let spans = t.chunks().iter().flat_map(|c| c.spans());
                let (mut size, mut fill) = (0.0f32, 0.0f32);
                for span in spans {
                    size = size.max(span.font_size().get());
                    fill = fill.max(span.fill().map(|f| f.opacity().get()).unwrap_or(0.0));
                }
                let m = t.abs_transform();
                let scale = (m.sx * m.sy - m.kx * m.ky).abs().sqrt();
                out.texts.push(Seen {
                    text: text.trim().to_owned(),
                    rect: rect(t.abs_bounding_box()),
                    opacity: opacity * fill,
                    px: size * scale,
                    masked,
                });
            }
            _ => {}
        }
    }
}

fn overlap(a: [f32; 4], b: [f32; 4]) -> (f32, f32) {
    let w = (a[0] + a[2]).min(b[0] + b[2]) - a[0].max(b[0]);
    let h = (a[1] + a[3]).min(b[1] + b[3]) - a[1].max(b[1]);
    (w.max(0.0), h.max(0.0))
}

fn quote(t: &str) -> String {
    let short: String = t.chars().take(40).collect();
    if short.len() < t.len() { format!("\"{short}…\"") } else { format!("\"{short}\"") }
}

/// Judges one frame. `next` is the frame after it: text that moved more than a few pixels in
/// between is in motion and is not judged for placement.
pub fn judge(now: &Scan, next: &Scan, w: f32, h: f32) -> Vec<Finding> {
    let unit = 1080.0 / w.min(h);
    let held: Vec<&Seen> = now
        .texts
        .iter()
        .filter(|t| t.opacity >= 0.6)
        .filter(|t| {
            next.texts.iter().any(|n| {
                n.text == t.text
                    && (0..4).all(|i| (n.rect[i] - t.rect[i]).abs() < 3.0)
            })
        })
        .collect();
    let mut found = Vec::new();
    let mut push = |level, kind, text: &str, message: String| {
        let f = Finding { level, kind, text: text.to_owned(), message };
        if !found.contains(&f) {
            found.push(f);
        }
    };
    for t in &held {
        let [x, y, tw, th] = t.rect;
        let disjoint = x + tw <= 0.0 || y + th <= 0.0 || x >= w || y >= h;
        let inside = x >= -1.0 && y >= -1.0 && x + tw <= w + 1.0 && y + th <= h + 1.0;
        if !t.masked && !disjoint && !inside {
            push("error", "edge", &t.text, format!("{} is cut off by the frame edge", quote(&t.text)));
        }
        // Title-safe: type a viewer must read stays within 90% of a landscape frame, and
        // within 80% of a vertical one's width (phone UI covers the edges).
        let (mx, my) = if h > w { (w * 0.1, h * 0.06) } else { (w * 0.05, h * 0.05) };
        if inside && (x < mx || x + tw > w - mx || y < my || y + th > h - my) && t.px * unit >= MIN_PX {
            push(
                "warning",
                "safe",
                &t.text,
                format!("{} runs outside the title-safe area (keep type {} the frame)", quote(&t.text), if h > w { "within the middle 80% of" } else { "within 90% of" }),
            );
        }
        if t.bars_cut(&now.bars) {
            push("error", "letterbox", &t.text, format!("{} is cut by the letterbox bars", quote(&t.text)));
        }
        let area = (tw * th).max(1.0);
        if now.subjects.iter().any(|s| {
            let (ow, oh) = overlap(t.rect, *s);
            ow * oh > area * 0.2
        }) {
            push("error", "subject", &t.text, format!("{} is printed over the subject", quote(&t.text)));
        }
        let px = t.px * unit;
        if disjoint || px < DETAIL_PX {
            continue;
        }
        if px < ILLEGIBLE_PX {
            push(
                "error",
                "small",
                &t.text,
                format!("{} is {px:.0} px tall at 1080p: too small to read (at least {MIN_PX:.0})", quote(&t.text)),
            );
        } else if px < MIN_PX {
            push(
                "warning",
                "small",
                &t.text,
                format!("{} is {px:.0} px tall at 1080p: hard to read on a phone (at least {MIN_PX:.0})", quote(&t.text)),
            );
        }
    }
    for (i, a) in held.iter().enumerate() {
        for b in held.iter().skip(i + 1) {
            // A highlight drawn over its own line, or a glow under its text, is one text.
            if a.text.contains(&b.text) || b.text.contains(&a.text) {
                continue;
            }
            // Line boxes include ascenders and descenders, so tight leading overlaps a little;
            // a collision covers a good part of the smaller text.
            let (ow, oh) = overlap(a.rect, b.rect);
            let smaller = (a.rect[2] * a.rect[3]).min(b.rect[2] * b.rect[3]).max(1.0);
            if ow * oh > smaller * 0.4 {
                push(
                    "error",
                    "overlap",
                    &a.text,
                    format!("{} overlaps {}", quote(&a.text), quote(&b.text)),
                );
            }
        }
    }
    found
}

impl Seen {
    fn bars_cut(&self, bars: &[[f32; 4]]) -> bool {
        bars.iter().any(|b| {
            let (ow, oh) = overlap(self.rect, *b);
            ow > 2.0 && oh > 2.0
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seen(text: &str, rect: [f32; 4], px: f32) -> Seen {
        Seen { text: text.into(), rect, opacity: 1.0, px, masked: false }
    }

    #[test]
    fn judges_held_text_for_edges_bars_subjects_overlap_and_size() {
        let now = Scan {
            texts: vec![
                seen("THE NIGHT SHIFT", [-300.0, 400.0, 2500.0, 200.0], 200.0),
                seen("Reservoir", [800.0, 930.0, 200.0, 40.0], 40.0),
                seen("Nothing extra.", [700.0, 500.0, 300.0, 50.0], 50.0),
                seen("Source: tiny", [40.0, 1040.0, 200.0, 10.0], 10.0),
                seen("A", [100.0, 100.0, 100.0, 50.0], 50.0),
                seen("B", [120.0, 110.0, 100.0, 50.0], 50.0),
                seen("next line", [100.0, 140.0, 100.0, 50.0], 50.0),
            ],
            bars: vec![[0.0, 940.0, 1920.0, 140.0]],
            subjects: vec![[650.0, 300.0, 500.0, 400.0]],
        };
        let found = judge(&now, &now, 1920.0, 1080.0);
        let kinds: Vec<_> = found.iter().map(|f| f.kind).collect();
        for kind in ["edge", "letterbox", "subject", "small", "overlap"] {
            assert!(kinds.contains(&kind), "{kind} not found in {found:?}");
        }
        assert!(!found.iter().any(|f| f.message.contains("next line")), "tight leading is not a collision");
        let moving = Scan { texts: vec![seen("THE NIGHT SHIFT", [-260.0, 400.0, 2500.0, 200.0], 200.0)], ..Default::default() };
        let only_title = Scan { texts: vec![now.texts[0].clone()], ..Default::default() };
        assert!(judge(&only_title, &moving, 1920.0, 1080.0).is_empty(), "text in motion is not judged");
    }
}
