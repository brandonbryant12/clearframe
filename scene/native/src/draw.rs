//! ClearFrame's display list: what a block draws for one frame. Blocks build a small tree of
//! groups, shapes, text runs and pictures out of Skia values (paths, matrices, shaders, image
//! filters, images), and `paint` draws it on the engine's canvas. The frame audit reads the
//! same tree (`visit`), so what is judged is exactly what is drawn.
//!
//! Group semantics: the transform applies to everything in the group, including its clip and
//! mask; the clip, mask, filter, opacity and blend apply to the group's content as one layer.
use crate::design;
use crate::fonts;
use crate::text::Font;
use skia_safe::{
    self as sk, BlendMode, Canvas, ClipOp, Color4f, ImageFilter, Matrix, Paint, PaintCap, PaintJoin, PaintStyle, Path,
    PathFillType, Point, RRect, Rect, Shader, TileMode, canvas::SaveLayerRec, gradient_shader,
};

#[derive(Clone)]
pub enum Node {
    Group(Box<Group>),
    Shape(Box<Shape>),
    Text(Box<Text>),
    Picture(Box<Picture>),
}

#[derive(Clone, Default)]
pub struct Group {
    pub children: Vec<Node>,
    pub opacity: f32,
    pub transform: Option<Matrix>,
    pub clip: Option<Path>,
    pub mask: Option<Mask>,
    pub filter: Option<ImageFilter>,
    /// The region a filter may draw in (its input and output), in the group's space.
    pub region: Option<Rect>,
    pub blend: Option<BlendMode>,
    /// Audit tags: `cf-bar…` (letterbox bars) and `…-subject-…` (the picture's subject).
    pub id: String,
}

#[derive(Clone)]
pub struct Mask {
    pub node: Node,
    /// Luminance mask (the SVG default); otherwise the mask's alpha.
    pub luminance: bool,
}

/// A colour or a shader (gradients). Shaders are in the shape's user space.
#[derive(Clone)]
pub enum Ink {
    Color(Color4f),
    Shader(Shader),
}

#[derive(Clone)]
pub struct Stroke {
    pub ink: Ink,
    pub width: f32,
    pub cap: PaintCap,
    pub join: PaintJoin,
    pub miter: f32,
    pub dash: Option<(Vec<f32>, f32)>,
    pub opacity: f32,
}

#[derive(Clone)]
pub struct Shape {
    pub path: Path,
    pub fill: Option<Ink>,
    pub fill_opacity: f32,
    pub stroke: Option<Stroke>,
    pub opacity: f32,
}

#[derive(Clone)]
pub struct Text {
    pub value: String,
    pub x: f32,
    pub y: f32,
    pub font: Font,
    pub size: f32,
    pub tracking: f32,
    pub color: Color4f,
    /// A round-joined stroke around the glyphs (colour, width), drawn over the fill.
    pub outline: Option<(Color4f, f32)>,
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Fit {
    /// Stretch to the box (`preserveAspectRatio="none"`).
    Fill,
    /// Fit inside the box, centred.
    Contain,
    /// Cover the box, centred, cropped to it.
    Cover,
}

#[derive(Clone)]
pub struct Picture {
    pub image: sk::Image,
    pub rect: Rect,
    pub fit: Fit,
    pub opacity: f32,
}

/// A colour from a `#rgb`/`#rrggbb` string; `None` for `none` or anything unparseable.
pub fn color(c: &str) -> Option<Color4f> {
    color_alpha(c, 1.0)
}

pub fn color_alpha(c: &str, alpha: f32) -> Option<Color4f> {
    let c = c.trim();
    if c.is_empty() || c == "none" || c == "transparent" {
        return None;
    }
    let rgb = if c.len() == 4 && c.starts_with('#') && c.is_ascii() {
        let d: String = c[1..].chars().flat_map(|ch| [ch, ch]).collect();
        design::parse(&format!("#{d}"))
    } else {
        match c {
            "white" => Some([1.0, 1.0, 1.0]),
            "black" => Some([0.0, 0.0, 0.0]),
            _ => design::parse(c),
        }
    }?;
    Some(Color4f::new(rgb[0], rgb[1], rgb[2], alpha.clamp(0.0, 1.0)))
}

pub fn ink(c: &str) -> Option<Ink> {
    color(c).map(Ink::Color)
}

// ---------------------------------------------------------------------------------------
// Building

pub fn empty() -> Node {
    Node::Group(Box::new(Group { opacity: 1.0, ..Default::default() }))
}

pub fn group(children: Vec<Node>) -> Node {
    Node::Group(Box::new(Group { children, opacity: 1.0, ..Default::default() }))
}

impl From<Shape> for Node {
    fn from(s: Shape) -> Node {
        Node::Shape(Box::new(s))
    }
}
impl From<Vec<Node>> for Node {
    fn from(v: Vec<Node>) -> Node {
        group(v)
    }
}
impl From<Text> for Node {
    fn from(t: Text) -> Node {
        Node::Text(Box::new(t))
    }
}
impl From<Picture> for Node {
    fn from(p: Picture) -> Node {
        Node::Picture(Box::new(p))
    }
}

impl Node {
    fn wrap(self) -> Group {
        Group { children: vec![self], opacity: 1.0, ..Default::default() }
    }
    /// This node inside a new group, to which `f` applies a property.
    fn wrapped(self, f: impl FnOnce(&mut Group)) -> Node {
        let mut g = self.wrap();
        f(&mut g);
        Node::Group(Box::new(g))
    }
    /// Multiply the opacity of the whole node (one layer, as SVG group opacity).
    pub fn opacity(self, alpha: f32) -> Node {
        if (alpha - 1.0).abs() < 1e-6 {
            return self;
        }
        match self {
            Node::Group(mut g) => {
                g.opacity *= alpha;
                Node::Group(g)
            }
            n => n.wrapped(|g| g.opacity = alpha),
        }
    }
    /// Apply `m` outside everything the node already has (its own transform, clip, filter).
    pub fn transform(self, m: Matrix) -> Node {
        if m.is_identity() {
            return self;
        }
        match self {
            Node::Group(mut g) => {
                g.transform = Some(match g.transform {
                    Some(t) => Matrix::concat(&m, &t),
                    None => m,
                });
                Node::Group(g)
            }
            n => n.wrapped(|g| g.transform = Some(m)),
        }
    }
    pub fn translate(self, dx: f32, dy: f32) -> Node {
        if dx == 0.0 && dy == 0.0 {
            return self;
        }
        self.transform(Matrix::translate((dx, dy)))
    }
    pub fn scale(self, sx: f32, sy: f32) -> Node {
        self.transform(Matrix::scale((sx, sy)))
    }
    /// Scale by `s` about (cx, cy): `translate(cx cy) scale(s) translate(-cx -cy)`.
    pub fn scale_about(self, s: f32, cx: f32, cy: f32) -> Node {
        self.transform(Matrix::scale_translate((s, s), (cx - s * cx, cy - s * cy)))
    }
    /// Rotate by `degrees` about (cx, cy), as SVG `rotate(a cx cy)`.
    pub fn rotate_about(self, degrees: f32, cx: f32, cy: f32) -> Node {
        if degrees == 0.0 {
            return self;
        }
        self.transform(Matrix::rotate_deg_pivot(degrees, (cx, cy)))
    }
    pub fn clip(self, path: Path) -> Node {
        self.wrapped(|g| g.clip = Some(path))
    }
    pub fn clip_rect(self, x: f32, y: f32, w: f32, h: f32) -> Node {
        self.clip(Path::rect(Rect::from_xywh(x, y, w.max(0.0), h.max(0.0)), None))
    }
    pub fn mask(self, mask: Node, luminance: bool) -> Node {
        self.wrapped(|g| g.mask = Some(Mask { node: mask, luminance }))
    }
    /// A filter confined to `region` (an SVG filter region in user space).
    pub fn filter_in(self, filter: Option<ImageFilter>, region: Rect) -> Node {
        match filter {
            Some(f) => self.wrapped(|g| {
                g.filter = Some(f);
                g.region = Some(region);
            }),
            None => self,
        }
    }
    pub fn blend(self, mode: BlendMode) -> Node {
        if mode == BlendMode::SrcOver {
            return self;
        }
        self.wrapped(|g| g.blend = Some(mode))
    }
    /// Stroke every text run in the node with `color` at `width`, round-joined (type that
    /// must read over anything: an outline in the background colour).
    pub fn outline(mut self, color: &str, width: f32) -> Node {
        fn set(n: &mut Node, c: Color4f, w: f32) {
            match n {
                Node::Group(g) => g.children.iter_mut().for_each(|c2| set(c2, c, w)),
                Node::Text(t) => t.outline = Some((c, w)),
                _ => {}
            }
        }
        if let Some(c) = self::color(color) {
            set(&mut self, c, width);
        }
        self
    }
    pub fn id(self, id: impl Into<String>) -> Node {
        let id = id.into();
        match self {
            Node::Group(mut g) if g.id.is_empty() => {
                g.id = id;
                Node::Group(g)
            }
            n => n.wrapped(|g| g.id = id),
        }
    }
}

/// An SVG-style blend mode name.
pub fn blend_mode(name: &str) -> BlendMode {
    match name {
        "multiply" => BlendMode::Multiply,
        "screen" => BlendMode::Screen,
        "overlay" => BlendMode::Overlay,
        "darken" => BlendMode::Darken,
        "lighten" => BlendMode::Lighten,
        "color-dodge" => BlendMode::ColorDodge,
        "color-burn" => BlendMode::ColorBurn,
        "hard-light" => BlendMode::HardLight,
        "soft-light" => BlendMode::SoftLight,
        "difference" => BlendMode::Difference,
        "exclusion" => BlendMode::Exclusion,
        "hue" => BlendMode::Hue,
        "saturation" => BlendMode::Saturation,
        "color" => BlendMode::Color,
        "luminosity" => BlendMode::Luminosity,
        "plus-lighter" => BlendMode::Plus,
        _ => BlendMode::SrcOver,
    }
}

impl Shape {
    pub fn new(path: Path) -> Shape {
        Shape { path, fill: None, fill_opacity: 1.0, stroke: None, opacity: 1.0 }
    }
    /// Fill with a colour string (`none` leaves the shape unfilled).
    pub fn fill(mut self, c: impl AsRef<str>) -> Shape {
        self.fill = ink(c.as_ref());
        self
    }
    pub fn fill_ink(mut self, ink: Option<Ink>) -> Shape {
        self.fill = ink;
        self
    }
    pub fn fill_opacity(mut self, a: f32) -> Shape {
        self.fill_opacity = a;
        self
    }
    /// Stroke with a colour string and width (round-free defaults: butt caps, miter joins).
    pub fn stroke(mut self, c: impl AsRef<str>, width: f32) -> Shape {
        self.stroke = ink(c.as_ref()).map(|ink| Stroke {
            ink,
            width,
            cap: PaintCap::Butt,
            join: PaintJoin::Miter,
            miter: 4.0,
            dash: None,
            opacity: 1.0,
        });
        self
    }
    pub fn stroke_ink(mut self, ink: Option<Ink>, width: f32) -> Shape {
        self.stroke = ink.map(|ink| Stroke {
            ink,
            width,
            cap: PaintCap::Butt,
            join: PaintJoin::Miter,
            miter: 4.0,
            dash: None,
            opacity: 1.0,
        });
        self
    }
    pub fn cap(mut self, cap: impl AsRef<str>) -> Shape {
        if let Some(s) = self.stroke.as_mut() {
            s.cap = match cap.as_ref() {
                "round" => PaintCap::Round,
                "square" => PaintCap::Square,
                _ => PaintCap::Butt,
            };
        }
        self
    }
    pub fn round(self) -> Shape {
        self.cap("round").join("round")
    }
    pub fn join(mut self, join: impl AsRef<str>) -> Shape {
        if let Some(s) = self.stroke.as_mut() {
            s.join = match join.as_ref() {
                "round" => PaintJoin::Round,
                "bevel" => PaintJoin::Bevel,
                _ => PaintJoin::Miter,
            };
        }
        self
    }
    /// `stroke-dasharray` lengths and `stroke-dashoffset`.
    pub fn dash(mut self, lengths: &[f32], offset: f32) -> Shape {
        if let Some(s) = self.stroke.as_mut() {
            let valid = !lengths.is_empty()
                && lengths.iter().all(|l| l.is_finite() && *l >= 0.0)
                && lengths.iter().sum::<f32>() > 0.0;
            s.dash = valid.then(|| {
                // An odd list repeats, as SVG specifies.
                let mut l = lengths.to_vec();
                if l.len() % 2 == 1 {
                    l.extend_from_slice(lengths);
                }
                (l, offset)
            });
        }
        self
    }
    /// `stroke-dasharray` given as text (`"6 10"` or `"6,10"`).
    pub fn dash_str(self, lengths: impl AsRef<str>, offset: f32) -> Shape {
        let l: Vec<f32> = lengths
            .as_ref()
            .split(|c: char| c == ',' || c.is_whitespace())
            .filter(|x| !x.is_empty())
            .filter_map(|x| x.parse().ok())
            .collect();
        self.dash(&l, offset)
    }
    pub fn stroke_opacity(mut self, a: f32) -> Shape {
        if let Some(s) = self.stroke.as_mut() {
            s.opacity = a;
        }
        self
    }
    pub fn opacity(mut self, a: f32) -> Shape {
        self.opacity *= a;
        self
    }
    pub fn even_odd(mut self) -> Shape {
        self.path = self.path.with_fill_type(PathFillType::EvenOdd);
        self
    }
    pub fn node(self) -> Node {
        self.into()
    }
}

pub fn rect(x: f32, y: f32, w: f32, h: f32) -> Shape {
    Shape::new(Path::rect(Rect::from_xywh(x, y, w.max(0.0), h.max(0.0)), None))
}
/// A rectangle with corner radii `rx`/`ry`, clamped to half its sides as SVG does.
pub fn rounded_rect(x: f32, y: f32, w: f32, h: f32, rx: f32, ry: f32) -> Shape {
    let (w, h) = (w.max(0.0), h.max(0.0));
    let (rx, ry) = (rx.max(0.0).min(w / 2.0), ry.max(0.0).min(h / 2.0));
    if rx <= 0.0 || ry <= 0.0 {
        return rect(x, y, w, h);
    }
    Shape::new(Path::rrect(RRect::new_rect_xy(Rect::from_xywh(x, y, w, h), rx, ry), None))
}
pub fn circle(cx: f32, cy: f32, r: f32) -> Shape {
    Shape::new(Path::circle((cx, cy), r.max(0.0), None))
}
pub fn ellipse(cx: f32, cy: f32, rx: f32, ry: f32) -> Shape {
    Shape::new(Path::oval(Rect::from_xywh(cx - rx, cy - ry, 2.0 * rx.max(0.0), 2.0 * ry.max(0.0)), None))
}
pub fn line(x1: f32, y1: f32, x2: f32, y2: f32) -> Shape {
    Shape::new(Path::line((x1, y1), (x2, y2)))
}
/// A closed polygon (`close`) or open polyline through `points`.
pub fn poly(points: &[(f32, f32)], close: bool) -> Shape {
    let pts: Vec<Point> = points.iter().map(|&(x, y)| Point::new(x, y)).collect();
    Shape::new(Path::polygon(&pts, close, None, None))
}
/// Path data in SVG syntax (`M 0 0 L 10 10 Z`); unparseable data draws nothing.
pub fn path(d: impl AsRef<str>) -> Shape {
    Shape::new(parse_path(d.as_ref()))
}
/// A polygon or polyline from SVG `points` text (`"x,y x,y …"`).
pub fn points(list: impl AsRef<str>, close: bool) -> Shape {
    let v: Vec<f32> = list
        .as_ref()
        .split(|c: char| c == ',' || c.is_whitespace())
        .filter(|x| !x.is_empty())
        .filter_map(|x| x.parse().ok())
        .collect();
    let pts: Vec<(f32, f32)> = v.chunks_exact(2).map(|p| (p[0], p[1])).collect();
    poly(&pts, close)
}
pub fn parse_path(d: &str) -> Path {
    Path::from_svg(d).unwrap_or_else(Path::new)
}

/// A text run with its baseline origin at (x, y).
pub fn text(value: impl Into<String>, x: f32, y: f32, font: Font, size: f32, tracking: f32, color: &str) -> Node {
    let value = value.into();
    match color_alpha(color, 1.0) {
        Some(color) if !value.is_empty() => Text { value, x, y, font, size, tracking, color, outline: None }.into(),
        _ => empty(),
    }
}

pub fn picture(image: sk::Image, x: f32, y: f32, w: f32, h: f32, fit: Fit) -> Node {
    Picture { image, rect: Rect::from_xywh(x, y, w, h), fit, opacity: 1.0 }.into()
}

/// A gradient stop: offset 0–1, colour, opacity.
pub type Stop<'s> = (f32, &'s str, f32);

fn stops(list: &[Stop]) -> (Vec<sk::Color4f>, Vec<f32>) {
    let mut colors = vec![];
    let mut pos = vec![];
    let mut last = 0.0f32;
    for (o, c, a) in list {
        let o = o.clamp(0.0, 1.0).max(last);
        last = o;
        pos.push(o);
        colors.push(color_alpha(c, *a).unwrap_or(Color4f::new(0.0, 0.0, 0.0, 0.0)));
    }
    (colors, pos)
}

/// A linear gradient between two points in user space.
pub fn linear(from: (f32, f32), to: (f32, f32), list: &[Stop], tile: TileMode, local: Option<&Matrix>) -> Option<Ink> {
    let (colors, pos) = stops(list);
    let colors: Vec<sk::Color> = colors.iter().map(|c| c.to_color()).collect();
    gradient_shader::linear(
        (Point::from(from), Point::from(to)),
        colors.as_slice(),
        Some(pos.as_slice()),
        tile,
        None,
        local,
    )
    .map(Ink::Shader)
}

/// A radial gradient in user space.
pub fn radial(centre: (f32, f32), r: f32, list: &[Stop], local: Option<&Matrix>) -> Option<Ink> {
    let (colors, pos) = stops(list);
    let colors: Vec<sk::Color> = colors.iter().map(|c| c.to_color()).collect();
    gradient_shader::radial(
        Point::from(centre),
        r.max(1e-3),
        colors.as_slice(),
        Some(pos.as_slice()),
        TileMode::Clamp,
        None,
        local,
    )
    .map(Ink::Shader)
}

/// The matrix mapping the unit square onto `bounds`: gradients in `objectBoundingBox` units.
pub fn bbox(bounds: Rect) -> Matrix {
    Matrix::scale_translate((bounds.width().max(1e-3), bounds.height().max(1e-3)), (bounds.left, bounds.top))
}

// ---------------------------------------------------------------------------------------
// Painting

fn ink_paint(ink: &Ink, alpha: f32) -> Paint {
    let mut p = Paint::default();
    p.set_anti_alias(true);
    match ink {
        Ink::Color(c) => {
            let mut c = *c;
            c.a *= alpha;
            p.set_color4f(c, None);
        }
        Ink::Shader(s) => {
            p.set_shader(s.clone());
            p.set_alpha_f(alpha.clamp(0.0, 1.0));
        }
    }
    p
}

fn stroke_paint(s: &Stroke, alpha: f32) -> Paint {
    let mut p = ink_paint(&s.ink, alpha * s.opacity);
    p.set_style(PaintStyle::Stroke);
    p.set_stroke_width(s.width.max(0.0));
    p.set_stroke_cap(s.cap);
    p.set_stroke_join(s.join);
    p.set_stroke_miter(s.miter);
    if let Some((l, off)) = &s.dash {
        p.set_path_effect(sk::PathEffect::dash(l, *off));
    }
    p
}

fn luminance_to_alpha() -> sk::ColorFilter {
    // SVG luminance masks use linearRGB-free coefficients on sRGB values.
    sk::color_filters::matrix_row_major(
        &[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2125, 0.7154, 0.0721, 0.0, 0.0],
        None,
    )
}

/// Draw `node` on `canvas` in the canvas's current coordinates.
pub fn paint(canvas: &Canvas, node: &Node) {
    match node {
        Node::Group(g) => paint_group(canvas, g),
        Node::Shape(s) => paint_shape(canvas, s),
        Node::Text(t) => {
            if t.color.a <= 0.0 {
                return;
            }
            let mut p = Paint::default();
            p.set_anti_alias(true);
            p.set_color4f(t.color, None);
            fonts::draw_run(canvas, &t.value, t.x, t.y, t.font, t.size, t.tracking, &p);
            if let Some((c, w)) = t.outline {
                p.set_color4f(Color4f { a: c.a * t.color.a, ..c }, None);
                p.set_style(PaintStyle::Stroke);
                p.set_stroke_width(w);
                p.set_stroke_join(PaintJoin::Round);
                fonts::draw_run(canvas, &t.value, t.x, t.y, t.font, t.size, t.tracking, &p);
            }
        }
        Node::Picture(pic) => paint_picture(canvas, pic),
    }
}

fn paint_group(canvas: &Canvas, g: &Group) {
    if g.opacity <= 0.0 || g.children.is_empty() {
        return;
    }
    let count = canvas.save();
    if let Some(t) = &g.transform {
        canvas.concat(t);
    }
    if let Some(clip) = &g.clip {
        canvas.clip_path(clip, ClipOp::Intersect, true);
    }
    if let Some(r) = &g.region {
        canvas.clip_rect(r, ClipOp::Intersect, true);
    }
    let layered = g.opacity < 1.0 || g.blend.is_some() || g.filter.is_some() || g.mask.is_some();
    if layered {
        let mut p = Paint::default();
        p.set_alpha_f(g.opacity.clamp(0.0, 1.0));
        if let Some(b) = g.blend {
            p.set_blend_mode(b);
        }
        if let Some(f) = &g.filter {
            p.set_image_filter(f.clone());
        }
        canvas.save_layer(&SaveLayerRec::default().paint(&p));
    }
    for child in &g.children {
        paint(canvas, child);
    }
    if let Some(m) = &g.mask {
        let mut p = Paint::default();
        p.set_blend_mode(BlendMode::DstIn);
        if m.luminance {
            p.set_color_filter(luminance_to_alpha());
        }
        canvas.save_layer(&SaveLayerRec::default().paint(&p));
        paint(canvas, &m.node);
        canvas.restore();
    }
    canvas.restore_to_count(count);
}

fn paint_shape(canvas: &Canvas, s: &Shape) {
    if s.opacity <= 0.0 {
        return;
    }
    let both = s.fill.is_some() && s.stroke.is_some();
    // Element opacity over a filled and stroked shape is one layer, so the stroke does not show
    // through the fill.
    let layered = both && s.opacity < 1.0;
    let alpha = if layered { 1.0 } else { s.opacity };
    if layered {
        canvas.save_layer_alpha_f(None, s.opacity);
    }
    if let Some(f) = &s.fill {
        canvas.draw_path(&s.path, &ink_paint(f, alpha * s.fill_opacity));
    }
    if let Some(st) = &s.stroke {
        if st.width > 0.0 {
            canvas.draw_path(&s.path, &stroke_paint(st, alpha));
        }
    }
    if layered {
        canvas.restore();
    }
}

fn paint_picture(canvas: &Canvas, pic: &Picture) {
    let (iw, ih) = (pic.image.width() as f32, pic.image.height() as f32);
    if iw <= 0.0 || ih <= 0.0 || pic.rect.is_empty() || pic.opacity <= 0.0 {
        return;
    }
    let r = pic.rect;
    let dst = match pic.fit {
        Fit::Fill => r,
        Fit::Contain | Fit::Cover => {
            let k = if pic.fit == Fit::Contain {
                (r.width() / iw).min(r.height() / ih)
            } else {
                (r.width() / iw).max(r.height() / ih)
            };
            let (w, h) = (iw * k, ih * k);
            Rect::from_xywh(r.left + (r.width() - w) / 2.0, r.top + (r.height() - h) / 2.0, w, h)
        }
    };
    let mut p = Paint::default();
    p.set_anti_alias(true);
    p.set_alpha_f(pic.opacity.clamp(0.0, 1.0));
    let sampling = sk::SamplingOptions::new(sk::FilterMode::Linear, sk::MipmapMode::Linear);
    let count = canvas.save();
    if pic.fit == Fit::Cover {
        canvas.clip_rect(r, ClipOp::Intersect, true);
    }
    canvas.draw_image_rect_with_sampling_options(&pic.image, None, dst, sampling, &p);
    canvas.restore_to_count(count);
}

// ---------------------------------------------------------------------------------------
// Reading the tree back (the frame audit)

/// What the audit sees of a node: its kind, absolute bounds and inherited state.
pub enum Seen<'n> {
    Group { group: &'n Group, bounds: Option<Rect>, opacity: f32 },
    Text { text: &'n Text, bounds: Rect, opacity: f32, scale: f32, masked: bool },
}

impl Node {
    /// Object bounding box in the node's own coordinates (strokes excluded, as SVG's bbox).
    pub fn bounds(&self) -> Option<Rect> {
        self.bounds_in(&Matrix::default())
    }
    fn bounds_in(&self, m: &Matrix) -> Option<Rect> {
        match self {
            Node::Group(g) => {
                let m = match &g.transform {
                    Some(t) => Matrix::concat(m, t),
                    None => *m,
                };
                let mut acc: Option<Rect> = None;
                for c in &g.children {
                    if let Some(b) = c.bounds_in(&m) {
                        acc = Some(acc.map_or(b, |a| Rect::join2(a, b)));
                    }
                }
                acc
            }
            Node::Shape(s) => {
                let b = s.path.compute_tight_bounds();
                (!b.is_empty() || b.width() > 0.0 || b.height() > 0.0).then(|| m.map_rect(b).0)
            }
            Node::Text(t) => fonts::text_box(&t.value, t.x, t.y, t.font, t.size, t.tracking).map(|b| m.map_rect(b).0),
            Node::Picture(p) => Some(m.map_rect(p.rect).0),
        }
    }

    /// Walk groups and text with absolute bounds, inherited opacity and whether a clip or mask
    /// is in effect. `visit` returns false to skip a group's children.
    pub fn visit<'n>(&'n self, visit: &mut impl FnMut(Seen<'n>) -> bool) {
        self.visit_in(&Matrix::default(), 1.0, false, visit);
    }
    fn visit_in<'n>(&'n self, m: &Matrix, opacity: f32, masked: bool, visit: &mut impl FnMut(Seen<'n>) -> bool) {
        match self {
            Node::Group(g) => {
                let o = opacity * g.opacity;
                let inner = match &g.transform {
                    Some(t) => Matrix::concat(m, t),
                    None => *m,
                };
                let bounds = self.bounds_in(m);
                if !visit(Seen::Group { group: g, bounds, opacity: o }) {
                    return;
                }
                let masked = masked || g.clip.is_some() || g.mask.is_some();
                for c in &g.children {
                    c.visit_in(&inner, o, masked, visit);
                }
            }
            Node::Text(t) => {
                if let Some(b) = fonts::text_box(&t.value, t.x, t.y, t.font, t.size, t.tracking) {
                    let scale = (m.scale_x() * m.scale_y() - m.skew_x() * m.skew_y()).abs().sqrt();
                    visit(Seen::Text { text: t, bounds: m.map_rect(b).0, opacity: opacity * t.color.a, scale, masked });
                }
            }
            _ => {}
        }
    }
}

fn hex4(c: &Color4f) -> String {
    let b = |v: f32| (v.clamp(0.0, 1.0) * 255.0).round() as u8;
    if c.a >= 0.999 {
        format!("#{:02x}{:02x}{:02x}", b(c.r), b(c.g), b(c.b))
    } else {
        format!("#{:02x}{:02x}{:02x}@{:.3}", b(c.r), b(c.g), b(c.b), c.a)
    }
}

impl std::fmt::Debug for Ink {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Ink::Color(c) => write!(f, "{}", hex4(c)),
            Ink::Shader(_) => write!(f, "shader"),
        }
    }
}

/// A compact dump of the tree for tests and debugging: text values are quoted, colours hex.
impl std::fmt::Debug for Node {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Node::Group(g) => {
                write!(f, "g(")?;
                if !g.id.is_empty() {
                    write!(f, "id={} ", g.id)?;
                }
                if g.opacity < 1.0 {
                    write!(f, "opacity={:.3} ", g.opacity)?;
                }
                if let Some(t) = &g.transform {
                    let v: [f32; 9] = std::array::from_fn(|i| t[i]);
                    write!(f, "transform={v:?} ")?;
                }
                if g.clip.is_some() {
                    write!(f, "clip ")?;
                }
                if g.mask.is_some() {
                    write!(f, "mask ")?;
                }
                if g.filter.is_some() {
                    write!(f, "filter ")?;
                }
                if let Some(b) = g.blend {
                    write!(f, "blend={b:?} ")?;
                }
                for c in &g.children {
                    write!(f, "{c:?} ")?;
                }
                write!(f, ")")
            }
            Node::Shape(s) => {
                write!(f, "path(d=\"{}\"", s.path.to_svg())?;
                if let Some(i) = &s.fill {
                    write!(f, " fill={i:?}")?;
                }
                if let Some(st) = &s.stroke {
                    write!(f, " stroke={:?} width={}", st.ink, st.width)?;
                }
                if s.opacity < 1.0 {
                    write!(f, " opacity={:.3}", s.opacity)?;
                }
                write!(f, ")")
            }
            Node::Text(t) => {
                write!(f, "text({:?} x={} y={} {:?} {} fill={})", t.value, t.x, t.y, t.font, t.size, hex4(&t.color))
            }
            Node::Picture(p) => write!(f, "image({}x{} at {:?})", p.image.width(), p.image.height(), p.rect),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn wrappers_compose_like_svg_groups() {
        let n = rect(0.0, 0.0, 10.0, 10.0).fill("#ff0000").node().translate(5.0, 0.0).opacity(0.5).opacity(0.5);
        let Node::Group(g) = &n else { panic!("a group") };
        assert!((g.opacity - 0.25).abs() < 1e-6);
        assert_eq!(n.bounds().unwrap(), Rect::from_xywh(5.0, 0.0, 10.0, 10.0));
        let scaled = rect(0.0, 0.0, 10.0, 10.0).fill("#000").node().scale_about(2.0, 10.0, 10.0);
        assert_eq!(scaled.bounds().unwrap(), Rect::from_xywh(-10.0, -10.0, 20.0, 20.0));
        assert!(color("none").is_none());
        assert_eq!(color("#fff").unwrap(), Color4f::new(1.0, 1.0, 1.0, 1.0));
        assert!(empty().bounds().is_none());
    }
}
