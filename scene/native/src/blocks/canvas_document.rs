//! A document: a page of real text (a policy, a plan summary, a client letter) that brings the
//! section the voice names into view and marks its words. Every heading and paragraph is laid
//! out by the shaper that draws it, so long copy never collides; the page scrolls inside its
//! own frame, and marks are the text's own (`marked`), attached to their words.
use super::*;
use serde_json::{Value, json};

/// One block of the page: a synthetic canvas text element and where its box starts and ends
/// (page coordinates, before scrolling).
struct Piece {
    el: Value,
    top: f32,
    bottom: f32,
    section: Option<usize>,
}

/// How far a section the voice is not on steps back once a scroll key names another.
const DIMMED: f32 = 0.4;

impl<'a, 'c> Draw<'a, 'c> {
    /// The page laid out top to bottom: kicker, title, a rule, then each section's heading and text.
    fn document_pieces(&self, el: &Value) -> (Vec<Piece>, Vec<f32>, f32) {
        let (x, w) = (f(el, "x", 0.0), f(el, "w", 900.0).max(200.0));
        let size = f(el, "size", 30.0).clamp(14.0, 72.0);
        let pad = size * 1.4;
        let inner = w - pad * 2.0;
        let mut pieces = vec![];
        let mut y = pad;
        let place = |pieces: &mut Vec<Piece>, y: &mut f32, text: &str, font: &str, px: f32, leading: f32, section: Option<usize>, extra: Value| {
            let style = Style {
                font: text_font(&json!({ "font": font, "size": px })),
                size: px,
                leading,
                tracking: f(&extra, "tracking", 0.0),
                upper: false,
                balance: extra.get("balance").and_then(Value::as_bool).unwrap_or(true),
            };
            let layout = self.fit(text, style, inner, 4000.0);
            let mut t = json!({ "type": "text", "text": text, "x": x + pad, "y": *y + layout.baseline, "size": px,
                "width": inner, "height": 4000.0, "leading": leading, "font": font });
            if let (Some(o), Some(e)) = (t.as_object_mut(), extra.as_object()) {
                o.extend(e.clone());
            }
            pieces.push(Piece { el: t, top: *y, bottom: *y + layout.height(), section });
            *y += layout.height();
        };
        let kicker = s(el, "kicker");
        if !kicker.trim().is_empty() {
            place(&mut pieces, &mut y, &kicker.to_uppercase(), "strong", size * 0.6, 1.2, None, json!({ "tracking": 0.08, "role": "kicker" }));
            y += size * 0.5;
        }
        let title = s(el, "title");
        if !title.trim().is_empty() {
            place(&mut pieces, &mut y, title, "display", size * 1.45, 1.12, None, json!({ "role": "title" }));
            y += size * 0.9;
        }
        let mut tops = vec![];
        for (i, section) in arr(el, "sections").iter().enumerate() {
            tops.push(y);
            let heading = s(section, "heading");
            if !heading.trim().is_empty() {
                place(&mut pieces, &mut y, heading, "strong", size * 1.02, 1.2, Some(i), json!({ "role": "heading" }));
                y += size * 0.35;
            }
            place(&mut pieces, &mut y, s(section, "text"), "text", size, 1.42, Some(i), json!({ "role": "body", "balance": false }));
            y += size * 1.1;
        }
        (pieces, tops, y - size * 1.1 + pad)
    }

    /// Which section a scroll key brings up: an index, or the first heading containing the words.
    fn document_section(el: &Value, to: &Value) -> Option<usize> {
        if let Some(i) = to.as_u64() {
            return Some(i as usize);
        }
        let words = to.as_str()?.to_lowercase();
        arr(el, "sections").iter().position(|section| {
            format!("{} {}", s(section, "heading"), s(section, "text")).to_lowercase().contains(&words)
        })
    }

    pub(super) fn document(&self, el: &Value, now: f32) -> Node {
        let (x, y, w, h) = (f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 900.0).max(200.0), f(el, "h", 700.0).max(120.0));
        let size = f(el, "size", 30.0).clamp(14.0, 72.0);
        let (pieces, tops, content) = self.document_pieces(el);
        // Scrolling: each key brings its section to the top of the frame, eased, never past the end.
        // The section it names comes into focus and the rest of the page steps back, so a key
        // still lands on its word when the page already shows that section.
        let room = (content - h).max(0.0);
        // The text stays inside the page's margin; at an edge with more beyond it (below until
        // the end is in view, above once it has scrolled) it fades into the paper first. A
        // section brought up sits just below the head's fade, so its heading reads in full.
        let inset = size * 0.8;
        let (foot, head) = ((h * 0.16).min(size * 3.0), size * 1.3);
        let mut offset = 0.0f32;
        let mut focus = vec![1.0f32; tops.len() + 1];
        for key in arr(el, "scroll") {
            let at = f(key, "at", 0.0);
            if now < at {
                break;
            }
            let Some(i) = Self::document_section(el, key.get("to").unwrap_or(&Value::Null)) else { continue };
            let target = (tops.get(i).copied().unwrap_or(0.0) - inset - head).clamp(0.0, room);
            let k = motion::in_out_cubic((now - at) / f(key, "dur", 0.9).max(0.05));
            offset += (target - offset) * k;
            for (j, v) in focus.iter_mut().enumerate() {
                *v += (if j == i { 1.0 } else { DIMMED } - *v) * k;
            }
        }
        let paper = match el.get("fill") {
            Some(v) => self.paint(Some(v), "bg"),
            None if self.p.dark => self.p.surface.clone(),
            None => crate::design::mix(&self.p.bg, "#ffffff", 0.72),
        };
        // Marks belong to the paragraph that holds their words (or the section they name).
        let marks = arr(el, "marks");
        let mut nodes = vec![];
        for piece in &pieces {
            let (top, bottom) = (piece.top - offset, piece.bottom - offset);
            if bottom < -size || top > h + size {
                continue;
            }
            let mut t = piece.el.clone();
            let page_y = f(&t, "y", 0.0);
            t["y"] = json!(y + page_y - offset);
            let role = s(&t, "role").to_owned();
            let ink = match role.as_str() {
                "kicker" => self.p.muted.clone(),
                _ => self.p.ink.clone(),
            };
            if role == "body" {
                let body = s(&t, "text").to_owned();
                let own: Vec<Value> = marks
                    .iter()
                    .filter(|m| {
                        let words = s(m, "words");
                        match m.get("section").and_then(Value::as_u64) {
                            Some(i) => piece.section == Some(i as usize),
                            None => text::find_words(&body, words).is_some(),
                        }
                    })
                    .cloned()
                    .collect();
                if !own.is_empty() {
                    t["marks"] = Value::Array(own);
                }
            }
            let node = self.canvas_text(&t, &ink, 1.0, now);
            // The kicker and title step back with the sections that are not in focus.
            let weight = focus[piece.section.unwrap_or(tops.len())];
            nodes.push(self.marked(&t, node, now).opacity(weight));
            if role == "title" {
                let rule_y = y + piece.bottom - offset + size * 0.45;
                nodes.push(draw::rect(x + size * 1.4, rule_y, w - size * 2.8, 2.0).paint_fill(&self.p.muted).opacity(0.35).node());
            }
        }
        let edge = |from: f32, to: f32| {
            let ink = draw::linear((0.0, from), (0.0, to), &[(0.0, paper.as_str(), 0.0), (1.0, paper.as_str(), 1.0)], skia_safe::TileMode::Clamp, None);
            draw::rect(x, from.min(to), w, (to - from).abs()).fill_ink(ink).node()
        };
        let more = Node::from(vec![
            if offset < room - 1.0 { edge(y + h - inset - foot, y + h - inset) } else { draw::empty() },
            if offset > 1.0 { edge(y + inset + head, y + inset) } else { draw::empty() },
        ]);
        let r = size * 0.5;
        let page = draw::rounded_rect(x, y, w, h, r, r).paint_fill(&paper).node();
        let body = draw::group(vec![Node::from(nodes), more]).clip_rect(x, y + inset + 2.0, w, h - inset * 2.0 - 4.0);
        draw::group(vec![page, body])
    }
}
