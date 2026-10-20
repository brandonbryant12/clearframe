//! The frame audit: what a director would send back, found in each drawn frame. Text cut
//! by the frame edge, text printed over other text or over the subject, and
//! type too small to read. `check` fails on any error. Only text that is held on screen is
//! judged: type crossing the edge in a whip or a camera move is the move, not a mistake.
use crate::draw::{self, Node};
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
    pub subjects: Vec<[f32; 4]>,
    /// Burned-in captions: judged as boxes the picture's type must keep clear of, not as type.
    pub captions: Vec<[f32; 4]>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Finding {
    pub level: &'static str,
    pub kind: &'static str,
    pub text: String,
    pub message: String,
}

fn rect(r: skia_safe::Rect) -> [f32; 4] {
    [r.left, r.top, r.width(), r.height()]
}

/// Everything the audit judges in a drawn tree: type (with its opacity, size and whether a
/// clip or mask cuts it on purpose) and the picture's subject.
pub fn scan(tree: &Node) -> Scan {
    let mut out = Scan::default();
    tree.visit(&mut |seen| match seen {
        draw::Seen::Group { group, bounds, opacity } => {
            if opacity < 0.05 {
                return false;
            }
            if group.id == "cf-captions" {
                out.captions.extend(bounds.map(rect));
                return false;
            }
            // A stamp is set over the type it judges on purpose.
            if group.id == "cf-stamp" {
                return false;
            }
            if group.id.contains("-subject-") && opacity > 0.5 {
                out.subjects.extend(bounds.map(rect));
            }
            true
        }
        draw::Seen::Text { text, bounds, opacity, scale, masked } => {
            if !text.value.trim().is_empty() {
                out.texts.push(Seen {
                    text: text.value.trim().to_owned(),
                    rect: rect(bounds),
                    opacity,
                    px: text.size * scale,
                    masked,
                });
            }
            true
        }
    });
    out
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
        .filter(|t| next.texts.iter().any(|n| n.text == t.text && (0..4).all(|i| (n.rect[i] - t.rect[i]).abs() < 3.0)))
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
                format!(
                    "{} runs outside the title-safe area (keep type {} the frame)",
                    quote(&t.text),
                    if h > w { "within the middle 80% of" } else { "within 90% of" }
                ),
            );
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
                format!(
                    "{} is {px:.0} px tall at 1080p: hard to read on a phone (at least {MIN_PX:.0})",
                    quote(&t.text)
                ),
            );
        }
    }
    // A caption over the picture's own type hides one or the other, even type stepped back (a
    // struck old figure, a page's other sections). Labels sit in buttons and cards a little
    // larger than their type, so the type's box is taken a little taller.
    let shown: Vec<&Seen> = now
        .texts
        .iter()
        .filter(|t| t.opacity >= 0.3)
        .filter(|t| next.texts.iter().any(|n| n.text == t.text && (0..4).all(|i| (n.rect[i] - t.rect[i]).abs() < 3.0)))
        .collect();
    for c in &now.captions {
        for t in &shown {
            let [x, y, tw, th] = t.rect;
            let (ow, oh) = overlap([x, y - th * 0.25, tw, th * 1.5], *c);
            if ow > 2.0 && oh > 2.0 {
                push(
                    "warning",
                    "caption",
                    &t.text,
                    format!(
                        "the caption covers {}: keep the picture's type out of the caption band (the bottom {:.0}% of the frame, or the top when the bottom is busy)",
                        quote(&t.text),
                        100.0 * (h - c[1]) / h
                    ),
                );
            }
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
                push("error", "overlap", &a.text, format!("{} overlaps {}", quote(&a.text), quote(&b.text)));
            }
        }
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seen(text: &str, rect: [f32; 4], px: f32) -> Seen {
        Seen { text: text.into(), rect, opacity: 1.0, px, masked: false }
    }

    #[test]
    fn judges_held_text_for_edges_subjects_overlap_and_size() {
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
            subjects: vec![[650.0, 300.0, 500.0, 400.0]],
            captions: vec![[600.0, 960.0, 700.0, 50.0]],
        };
        let found = judge(&now, &now, 1920.0, 1080.0);
        let kinds: Vec<_> = found.iter().map(|f| f.kind).collect();
        for kind in ["edge", "subject", "small", "overlap", "caption"] {
            assert!(kinds.contains(&kind), "{kind} not found in {found:?}");
        }
        assert!(!found.iter().any(|f| f.message.contains("next line")), "tight leading is not a collision");
        let moving =
            Scan { texts: vec![seen("THE NIGHT SHIFT", [-260.0, 400.0, 2500.0, 200.0], 200.0)], ..Default::default() };
        let only_title = Scan { texts: vec![now.texts[0].clone()], ..Default::default() };
        assert!(judge(&only_title, &moving, 1920.0, 1080.0).is_empty(), "text in motion is not judged");
    }

    #[test]
    fn text_a_clip_hides_is_not_seen_and_a_stamp_is_read_apart() {
        let font = crate::text::Font::Text;
        let page = draw::group(vec![
            draw::text("on the page", 100.0, 200.0, font, 40.0, 0.0, "#000000"),
            draw::text("below the page", 100.0, 900.0, font, 40.0, 0.0, "#000000"),
        ])
        .clip_rect(0.0, 0.0, 800.0, 600.0);
        let stamp = draw::group(vec![draw::text("PAID", 100.0, 200.0, font, 40.0, 0.0, "#c00000")]).id("cf-stamp");
        let scan = scan(&draw::group(vec![page, stamp]));
        let texts: Vec<_> = scan.texts.iter().map(|t| t.text.as_str()).collect();
        assert_eq!(texts, ["on the page"], "the clipped line and the stamp are not judged as the page's type");
        assert!(scan.texts[0].rect[3] > 0.0 && scan.texts[0].rect[1] + scan.texts[0].rect[3] <= 600.0);
    }
}
