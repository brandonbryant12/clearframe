use crate::{Beat, Caption};
use fframes::{FFramesContext, FFramesSyncedVideoFrame, Frame, Svgr, SyncVideoFrameInput};
use serde_json::Value;

#[path = "diagrams.rs"]
mod diagrams;
pub(crate) use diagrams::validate as validate_diagram;

#[derive(Clone)]
pub struct Palette {
    pub bg: String, pub surface: String, pub ink: String, pub muted: String,
    pub accent: String,
}
impl Palette {
    pub fn from_theme(theme: &Value) -> Self {
        let base = theme.as_str().or_else(|| theme.get("base").and_then(Value::as_str)).unwrap_or("paper");
        let colors = match base {
            "ink" => ["#101721", "#1d2938", "#f4f4ed", "#a4b2c4", "#76cbb8"],
            "editorial" => ["#f7efe1", "#ebddc6", "#34281f", "#74604e", "#b13e2e"],
            "signal" => ["#edf3f8", "#dce7f1", "#102e46", "#507089", "#006dae"],
            _ => ["#f5f3ed", "#e9e7df", "#222831", "#616b76", "#315cce"],
        };
        let get = |key: &str, fallback: &str| theme.get(key).and_then(Value::as_str).unwrap_or(fallback).to_owned();
        Self { bg:get("bg",colors[0]), surface:get("surface",colors[1]), ink:get("ink",colors[2]), muted:get("muted",colors[3]), accent:get("accent",colors[4]) }
    }
}

pub fn backdrop<'a>(kind:&str, w:f32, h:f32, p:&Palette) -> Svgr<'a> {
    let mut shapes = vec![];
    if kind == "grid" {
        for x in (0..w as usize).step_by(80) { shapes.push(fframes::svgr!(<line x1={x} x2={x} y1="0" y2={h} stroke={p.muted.clone()} stroke-width="1" />)); }
        for y in (0..h as usize).step_by(80) { shapes.push(fframes::svgr!(<line x1="0" x2={w} y1={y} y2={y} stroke={p.muted.clone()} stroke-width="1" />)); }
    } else if kind == "dots" {
        for x in (24..w as usize).step_by(48) { for y in (24..h as usize).step_by(48) {
            shapes.push(fframes::svgr!(<circle cx={x} cy={y} r="1.6" fill={p.muted.clone()} />));
        } }
    }
    fframes::svgr!(<g opacity="0.09">{shapes}</g>)
}

fn s<'a>(v:&'a Value, key:&str) -> &'a str { v.get(key).and_then(Value::as_str).unwrap_or("") }
fn n(v:&Value,key:&str,default:f64) -> f64 { v.get(key).and_then(Value::as_f64).unwrap_or(default) }
fn arr<'a>(v:&'a Value,key:&str) -> &'a [Value] { v.get(key).and_then(Value::as_array).map(Vec::as_slice).unwrap_or(&[]) }
fn nonempty<'a>(a:&'a str,b:&'a str) -> &'a str { if a.is_empty() { b } else { a } }
fn ease(x:f32) -> f32 { 1.0-(1.0-x.clamp(0.0,1.0)).powi(3) }
fn at(v:&Value,base:f32,index:usize) -> f32 { n(v,"at",base as f64+index as f64*0.14) as f32 }
fn active_word(words:&[Caption],time:f32)->Option<usize> {
    words.iter().position(|word|time>=word.start && time<word.end)
}
/// Phrase membership is derived from prepared timestamps, never estimated from text.
fn word_window(words:&[Caption],time:f32,max_words:usize,max_gap:f32,max_duration:f32)->std::ops::Range<usize> {
    if words.is_empty() {return 0..0;}
    let latest=words.iter().rposition(|word|time>=word.start).unwrap_or(0);
    let mut start=0;
    for index in 1..words.len() {
        let boundary=index-start>=max_words.max(1)
            || words[index].start-words[index-1].end>max_gap
            || words[index].end-words[start].start>max_duration;
        if boundary {
            if latest<index {return start..index;}
            start=index;
        }
    }
    start..words.len()
}
fn media_frame_at(scene_frame:&Frame,offset:f64)->Frame {
    let mut frame=scene_frame.clone();
    frame.index+=(offset*scene_frame.fps as f64).round() as usize;
    frame
}
fn axis_label_indices(xs:&[f64])->Vec<usize> {
    if xs.len()<2{return (0..xs.len()).collect();}
    let first=xs[0];let span=xs[xs.len()-1]-first;let gap=span/6.0;
    let mut indices=vec![0];let mut previous=first;
    for (i,&x) in xs.iter().enumerate().take(xs.len()-1).skip(1) {
        if x-previous>=gap && xs[xs.len()-1]-x>=gap {indices.push(i);previous=x;}
    }
    indices.push(xs.len()-1);indices
}

/// Locale-independent grouping, signed values and suffixes stay one atomic string.
pub fn format_number(value:f64,decimals:usize,prefix:&str,suffix:&str) -> String {
    let decimals = decimals.min(8);
    let threshold = 0.5 * 10_f64.powi(-(decimals as i32));
    let value = if value.abs() < threshold { 0.0 } else { value };
    let raw = format!("{:.*}", decimals, value.abs());
    let mut parts = raw.split('.');
    let integer = parts.next().unwrap_or("0");
    let grouped: String = integer.chars().enumerate().flat_map(|(i,c)| {
        let mut x=String::new(); if i>0 && (integer.len()-i)%3 == 0 {x.push(',');} x.push(c); x.chars().collect::<Vec<_>>()
    }).collect();
    let fraction = parts.next().map(|v|format!(".{v}")).unwrap_or_default();
    format!("{}{prefix}{grouped}{fraction}{suffix}", if value < 0.0 { "−" } else { "" })
}
fn format_with(value:f64,format:&Value) -> String {
    if let Some(suffix)=format.as_str() { format_number(value,0,"",suffix) }
    else { format_number(value,n(format,"decimals",0.0) as usize,s(format,"prefix"),s(format,"suffix")) }
}
pub fn zero_scale(value:f64,max:f64) -> f64 { if max<=0.0 {0.0} else {(value/max).clamp(0.0,1.0)} }

fn text<'a>(value:impl Into<String>,x:f32,y:f32,size:f32,color:&str,weight:u16) -> Svgr<'a> {
    fframes::svgr!(<text x={x} y={y} font-family="Inter" font-weight={weight.to_string()} font-size={size} fill={color.to_owned()}>{value.into()}</text>)
}
fn rect<'a>(x:f32,y:f32,w:f32,h:f32,color:&str) -> Svgr<'a> {
    if w<=0.0 || h<=0.0 { return fframes::svgr!(<g />); }
    fframes::svgr!(<rect x={x} y={y} width={w} height={h} fill={color.to_owned()} />)
}
fn rule<'a>(x:f32,y:f32,w:f32,color:&str) -> Svgr<'a> { rect(x,y,w,2.0,color) }
fn reveal<'a>(body:Svgr<'a>,progress:f32,distance:f32) -> Svgr<'a> {
    fframes::svgr!(<g opacity={progress.clamp(0.0,1.0)} transform={format!("translate(0 {})",distance*(1.0-progress))}>{body}</g>)
}

#[derive(Clone,Copy)]
struct Area { x:f32, y:f32, w:f32, h:f32 }
struct Draw<'a,'c,'m> {
    b:&'a Beat, f:Frame, ctx:&'c FFramesContext<'a,'m>, p:Palette, area:Area, t:f32, wide:bool,
}
impl<'a,'c,'m> Draw<'a,'c,'m> {
    fn width(&mut self,value:&str,size:f32,weight:u16)->f32 {
        // Resolve glyph advances directly: upstream Frame::text_width unnecessarily
        // ties the temporary text's lifetime to the entire prepared film.
        let face=self.ctx.font_source.and_then(|fonts|fonts.resolve_font("Inter",weight,Default::default(),Default::default()));
        if let Some(face)=face {
            value.chars().map(|c|face.resolve_char_width(size.ceil() as usize,c).unwrap_or((size*0.59) as usize) as f32).sum()
        } else {value.chars().count() as f32*size*0.59}
    }
    fn lines(&mut self,value:&str,size:f32,weight:u16,width:f32)->Vec<String> {
        let mut lines=vec![];
        for paragraph in value.split('\n') {
            let mut current=String::new();
            for word in paragraph.split_whitespace() {
                let candidate=if current.is_empty(){word.to_owned()}else{format!("{current} {word}")};
                if !current.is_empty() && self.width(&candidate,size,weight)>width {
                    lines.push(current);current=word.to_owned();
                } else {current=candidate;}
            }
            lines.push(current);
        }
        lines
    }
    /// Shrinks and wraps using prepared Inter metrics. Unfit text fails instead
    /// of spilling into another scene element or dropping authored words.
    fn paragraph(&mut self,value:&str,box_:Area,size:f32,color:&str,weight:u16,center:bool)->Svgr<'a> {
        if value.trim().is_empty() {return fframes::svgr!(<g />);}
        let mut size=size.max(14.0);
        let mut lines=self.lines(value,size,weight,box_.w);
        while size>14.0 && (lines.len() as f32*size*1.22>box_.h || lines.iter().any(|line|self.width(line,size,weight)>box_.w)) {
            size=(size-1.0).max(14.0);lines=self.lines(value,size,weight,box_.w);
        }
        let measured_width=lines.iter().map(|line|self.width(line,size,weight)).fold(0.0_f32,f32::max);
        let measured_height=lines.len() as f32*size*1.22;
        assert!(measured_width<=box_.w+0.01 && measured_height<=box_.h+0.01,
            "Text overflow in scene '{}' ({}): text needs {:.1}×{:.1}px at {:.1}px, but its box is {:.1}×{:.1}px. Shorten or reflow the text, or use a less dense layout; the minimum font size is 14px.",
            self.b.id,self.b.block,measured_width,measured_height,size,box_.w,box_.h);
        let mut out=vec![];
        for (i,line) in lines.into_iter().enumerate() {
            let x=if center {box_.x+(box_.w-self.width(&line,size,weight))/2.0}else{box_.x};
            out.push(text(line,x,box_.y+size+i as f32*size*1.22,size,color,weight));
        }
        fframes::svgr!(<g>{out}</g>)
    }
    fn progress(&self,time:f32)->f32 {
        let duration=match self.b.environment.motion.preset.as_str(){"snappy"=>0.30,"spring"=>0.72,_=>0.55};
        ease((self.t-time)/duration)
    }
    fn numeric(&self,v:&Value,time:f32)->String {
        let from=n(v,"from",0.0);let to=n(v,"value",0.0);
        format_number(from+(to-from)*ease((self.t-time)/1.15) as f64,n(v,"decimals",0.0) as usize,s(v,"prefix"),s(v,"suffix"))
    }
    fn header(&mut self)->Svgr<'a> {
        let x=self.area.x;let w=self.area.w;
        let kicker=s(&self.b.props,"kicker");
        let title=s(&self.b.props,"title");
        let shift=if self.b.environment.height>self.b.environment.width{self.b.environment.height*0.11-108.0}else{0.0};
        let a=self.paragraph(kicker,Area{x,y:108.0+shift,w,h:38.0},24.0,&self.p.accent.clone(),600,false);
        let b=self.paragraph(title,Area{x,y:164.0+shift,w,h:142.0},if self.wide{62.0}else{58.0},&self.p.ink.clone(),600,false);
        fframes::svgr!(<g>{a}{b}</g>)
    }
    fn hero(&mut self)->Svgr<'a> {
        let a=self.area;let props=&self.b.props;
        let headline=nonempty(s(props,"text"),s(props,"title"));
        let support=nonempty(s(props,"support"),s(props,"context"));
        let is_title=self.b.block=="title";
        let top=if is_title {a.y+0.12*a.h}else{a.y+0.05*a.h};
        let line=rule(a.x,top-35.0,if is_title{96.0}else{a.w},&self.p.accent);
        let h=self.paragraph(headline,Area{x:a.x,y:top,w:a.w,h:a.h*0.61},if self.wide{118.0}else{94.0},&self.p.ink.clone(),600,false);
        let sub=self.paragraph(support,Area{x:a.x,y:top+a.h*0.66,w:a.w*0.92,h:a.h*0.22},36.0,&self.p.muted.clone(),400,false);
        let kicker_y=if self.b.environment.height>self.b.environment.width{self.b.environment.height*0.11}else{118.0};
        let kicker=self.paragraph(s(props,"kicker"),Area{x:a.x,y:kicker_y,w:a.w,h:60.0},26.0,&self.p.accent.clone(),600,false);
        fframes::svgr!(<g>{kicker}{line}{h}{sub}</g>)
    }
    fn stat(&mut self)->Svgr<'a> {
        let a=self.area;let props=&self.b.props;
        let number=self.numeric(props,self.b.cue_seconds);
        let value=self.paragraph(&number,Area{x:a.x,y:a.y+a.h*0.05,w:a.w,h:a.h*0.48},if self.wide{220.0}else{174.0},&self.p.accent.clone(),600,false);
        let label=self.paragraph(s(props,"label"),Area{x:a.x,y:a.y+a.h*0.55,w:a.w,h:a.h*0.18},44.0,&self.p.ink.clone(),600,false);
        let context=self.paragraph(nonempty(s(props,"context"),s(props,"support")),Area{x:a.x,y:a.y+a.h*0.79,w:a.w,h:a.h*0.18},32.0,&self.p.muted.clone(),400,false);
        fframes::svgr!(<g>{value}{label}{context}</g>)
    }
    fn kpis(&mut self)->Svgr<'a> {
        let a=self.area;let items=arr(&self.b.props,"items");let count=items.len().max(1);
        let columns=if self.wide{count.min(3)}else{if count>3{2}else{1}};
        let rows=count.div_ceil(columns);let cellw=a.w/columns as f32;let cellh=a.h/rows as f32;
        let mut shapes=vec![];
        for (i,item) in items.iter().enumerate(){
            let x=a.x+(i%columns) as f32*cellw;let y=a.y+(i/columns) as f32*cellh;
            let t=at(item,self.b.cue_seconds,i);let value=self.numeric(item,t);
            let rule=rule(x,y,cellw-36.0,&self.p.surface);
            let number=self.paragraph(&value,Area{x,y:y+20.0,w:cellw-36.0,h:cellh*0.48},if self.wide{116.0}else{106.0},&self.p.accent.clone(),600,false);
            let label=self.paragraph(s(item,"label"),Area{x,y:y+cellh*0.60,w:cellw-36.0,h:cellh*0.3},34.0,&self.p.ink.clone(),400,false);
            shapes.push(reveal(fframes::svgr!(<g>{rule}{number}{label}</g>),self.progress(t),18.0));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn bars(&mut self)->Svgr<'a> {
        let a=self.area;let props=&self.b.props;let rows=arr(props,"data");let count=rows.len().max(1);
        let max=n(props,"max",rows.iter().map(|r|n(r,"value",0.0)).fold(0.0,f64::max)).max(1e-9);
        let format=&props["format"];let focus=&props["focus"];
        let focus_index=focus.get("index").and_then(Value::as_u64).map(|v|v as usize);
        let focus_at=n(focus,"at",self.b.cue_seconds as f64+1.4) as f32;
        let dim=n(focus,"dim",0.28).clamp(0.0,1.0) as f32;
        let focus_duration=n(focus,"dur",0.5) as f32;
        let focus_p=if !focus.is_object(){0.0}else if focus_duration<=0.0{if self.t>=focus_at{1.0}else{0.0}}else{ease((self.t-focus_at)/focus_duration)};
        let horizontal=s(props,"orientation")!="vertical";
        let note=s(focus,"note");let chart_h=a.h-if note.is_empty(){20.0}else{96.0};
        let mut shapes=vec![];
        if horizontal {
            let labelw=if self.wide{a.w*0.23}else{a.w*0.28};let valuew=if self.wide{a.w*0.18}else{a.w*0.23};
            let plotx=a.x+labelw;let plotw=a.w-labelw-valuew-24.0;let rowh=chart_h/count as f32;
            shapes.push(rect(plotx,a.y,2.0,chart_h,&self.p.muted));
            for (i,row) in rows.iter().enumerate(){
                let y=a.y+i as f32*rowh+rowh*0.19;let bh=(rowh*0.47).min(62.0);
                let grow=ease((self.t-self.b.cue_seconds-i as f32*0.10)/1.15);
                let value=n(row,"value",0.0);let width=plotw*zero_scale(value,max) as f32*grow;
                let label=self.paragraph(s(row,"label"),Area{x:a.x,y:y-5.0,w:labelw-24.0,h:rowh*0.76},32.0,&self.p.ink.clone(),400,false);
                let number=self.paragraph(&format_with(value,format),Area{x:plotx+plotw+20.0,y:y-5.0,w:valuew,h:rowh*0.76},32.0,&self.p.ink.clone(),600,false);
                let bar=rect(plotx+2.0,y,width,bh,&self.p.accent);
                let opacity=if focus_index.is_some_and(|f|f!=i){1.0-focus_p*(1.0-dim)}else{1.0};
                shapes.push(fframes::svgr!(<g opacity={opacity}>{label}{bar}{number}</g>));
            }
            shapes.push(text("0",plotx,a.y+chart_h+27.0,22.0,&self.p.muted,400));
        } else {
            let plot_y=a.y+45.0;let plot_h=chart_h-150.0;let baseline=plot_y+plot_h;
            let slot=a.w/count as f32;let bw=(slot*0.57).min(190.0);
            shapes.push(rule(a.x,baseline,a.w,&self.p.muted));
            shapes.push(text("0",a.x-28.0,baseline+8.0,22.0,&self.p.muted,400));
            for (i,row) in rows.iter().enumerate(){
                let x=a.x+slot*i as f32+(slot-bw)/2.0;let grow=ease((self.t-self.b.cue_seconds-i as f32*0.10)/1.15);
                let value=n(row,"value",0.0);let height=plot_h*zero_scale(value,max) as f32*grow;
                let label=self.paragraph(s(row,"label"),Area{x:a.x+slot*i as f32+9.0,y:baseline+17.0,w:slot-18.0,h:106.0},30.0,&self.p.ink.clone(),400,true);
                let number=self.paragraph(&format_with(value,format),Area{x:a.x+slot*i as f32+6.0,y:baseline-height-49.0,w:slot-12.0,h:44.0},30.0,&self.p.ink.clone(),600,true);
                let bar=rect(x,baseline-height,bw,height,&self.p.accent);
                let opacity=if focus_index.is_some_and(|f|f!=i){1.0-focus_p*(1.0-dim)}else{1.0};
                shapes.push(fframes::svgr!(<g opacity={opacity}>{bar}{label}{number}</g>));
            }
        }
        if !note.is_empty(){
            let note=self.paragraph(note,Area{x:a.x,y:a.y+a.h-55.0,w:a.w,h:62.0},30.0,&self.p.accent.clone(),600,false);
            shapes.push(reveal(note,focus_p,8.0));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn line(&mut self)->Svgr<'a> {
        let a=self.area;let p=&self.b.props;let series=arr(p,"series");let format=&p["format"];
        let low=n(p,"min",series.iter().map(|v|n(v,"y",0.0)).fold(0.0,f64::min));
        let high=n(p,"max",series.iter().map(|v|n(v,"y",0.0)).fold(low,f64::max));
        let span=(high-low).max(1e-9);let minx=series.first().map(|v|n(v,"x",0.0)).unwrap_or(0.0);
        let maxx=series.last().map(|v|n(v,"x",1.0)).unwrap_or(1.0);let xrange=(maxx-minx).max(1e-9);
        let x=a.x+a.w*0.13;let y=a.y+20.0;let w=a.w*0.84;let h=a.h-125.0;
        let mut shapes=vec![];
        for i in 0..=4 {
            let value=low+span*i as f64/4.0;let tick_y=y+h-h*i as f32/4.0;
            shapes.push(rule(x,tick_y,w,&self.p.surface));
            shapes.push(self.paragraph(&format_with(value,format),Area{x:a.x,y:tick_y-18.0,w:a.w*0.11,h:36.0},24.0,&self.p.muted.clone(),400,false));
        }
        let progress=ease((self.t-self.b.cue_seconds)/1.5);
        let count=series.len();let traversed=progress*count.saturating_sub(1) as f32;
        let mut path=String::new();let mut last=None;
        for (i,item) in series.iter().enumerate(){
            if i as f32>traversed+1.0 {break;}
            let mut px=x+(n(item,"x",i as f64)-minx) as f32/xrange as f32*w;
            let mut py=y+h-(n(item,"y",0.0)-low) as f32/span as f32*h;
            if i as f32>traversed {
                if let Some((prev_x,prev_y))=last {
                    let part=traversed.fract();px=prev_x+(px-prev_x)*part;py=prev_y+(py-prev_y)*part;
                } else {break;}
            }
            path.push_str(&format!("{} {px} {py} ",if i==0{"M"}else{"L"}));last=Some((px,py));
            if i as f32>traversed {break;}
        }
        shapes.push(fframes::svgr!(<path d={path} stroke={self.p.accent.clone()} stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" />));
        if let Some((cx,cy))=last{shapes.push(fframes::svgr!(<circle cx={cx} cy={cy} r="8" fill={self.p.accent.clone()} />));}
        let labels=arr(p,"labels");
        let xs:Vec<f64>=series.iter().enumerate().map(|(i,v)|n(v,"x",i as f64)).collect();
        for i in axis_label_indices(&xs){
            let Some(label)=labels.get(i)else{continue;};
            let lx=x+w*((xs[i]-minx)/xrange) as f32;
            let width=(w/7.0).min(180.0);
            shapes.push(self.paragraph(label.as_str().unwrap_or(""),Area{x:lx-width/2.0,y:y+h+20.0,w:width,h:80.0},24.0,&self.p.muted.clone(),400,true));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn waffle(&mut self)->Svgr<'a> {
        let a=self.area;let p=&self.b.props;let total=n(p,"total",100.0) as usize;let cols=n(p,"cols",10.0).max(1.0) as usize;
        let count=n(p,"value",0.0) as usize;let rows=total.div_ceil(cols);let gridw=if self.wide{a.w*0.46}else{a.w*0.84};
        let gridh=if self.wide{a.h*0.87}else{a.h*0.68};let cell=(gridw/cols as f32).min(gridh/rows.max(1) as f32);let gap=(cell*0.18).max(3.0);
        let mut tiles=vec![];
        for i in 0..total {
            let grow=self.progress(self.b.cue_seconds+i as f32*0.005);
            let color=if i<count{&self.p.accent}else{&self.p.surface};
            tiles.push(reveal(rect(a.x+(i%cols) as f32*cell,a.y+(i/cols) as f32*cell,cell-gap,cell-gap,color),grow,10.0));
        }
        let (tx,ty,tw,th)=if self.wide{(a.x+a.w*0.56,a.y+a.h*0.12,a.w*0.44,a.h*0.78)}else{(a.x,a.y+a.h*0.73,a.w,a.h*0.26)};
        let number=self.paragraph(&format!("{count} / {total}"),Area{x:tx,y:ty,w:tw,h:th*0.57},if self.wide{116.0}else{76.0},&self.p.accent.clone(),600,false);
        let label=self.paragraph(s(p,"label"),Area{x:tx,y:ty+th*0.62,w:tw,h:th*0.35},34.0,&self.p.ink.clone(),400,false);
        fframes::svgr!(<g>{tiles}{number}{label}</g>)
    }
    fn ring(&mut self)->Svgr<'a> {
        let a=self.area;let p=&self.b.props;let value=n(p,"value",0.0);let max=n(p,"max",100.0);let progress=ease((self.t-self.b.cue_seconds)/1.3);
        let diameter=(if self.wide{a.w*0.38}else{a.w*0.72}).min(a.h*0.77);let r=diameter*0.5;let cx=a.x+if self.wide{a.w*0.25}else{a.w*0.5};let cy=a.y+r+15.0;
        let circumference=std::f32::consts::TAU*r;let arc=circumference*zero_scale(value,max) as f32*progress;
        let shape=fframes::svgr!(<g>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={self.p.surface.clone()} stroke-width="24" />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={self.p.accent.clone()} stroke-width="24" stroke-dasharray={format!("{arc} {circumference}")} transform={format!("rotate(-90 {cx} {cy})")} />
        </g>);
        let display=format_number(value*progress as f64,n(p,"decimals",0.0) as usize,"",if max==100.0{"%"}else{""});
        let number=self.paragraph(&display,Area{x:cx-r*0.85,y:cy-65.0,w:r*1.70,h:130.0},106.0,&self.p.ink.clone(),600,true);
        let label_box=if self.wide{Area{x:a.x+a.w*0.57,y:a.y+a.h*0.22,w:a.w*0.40,h:a.h*0.6}}else{Area{x:a.x,y:cy+r+35.0,w:a.w,h:a.h-diameter-40.0}};
        let label=self.paragraph(s(p,"label"),label_box,44.0,&self.p.ink.clone(),400,!self.wide);
        fframes::svgr!(<g>{shape}{number}{label}</g>)
    }
    fn delta(&mut self)->Svgr<'a> {
        let a=self.area;let p=&self.b.props;let from=&p["from"];let to=&p["to"];
        let mut shapes=vec![];
        for (i,item) in [from,to].iter().enumerate(){
            let (x,y,w,h)=if self.wide{(a.x+i as f32*a.w*0.56,a.y,a.w*0.42,a.h*0.78)}else{(a.x,a.y+i as f32*a.h*0.43,a.w,a.h*0.36)};
            let color=if i==0{self.p.muted.clone()}else{self.p.accent.clone()};
            let value=format_number(n(item,"value",0.0),n(p,"decimals",0.0) as usize,s(p,"prefix"),s(p,"suffix"));
            let label=self.paragraph(s(item,"label"),Area{x,y,w,h:h*0.25},32.0,&self.p.muted.clone(),400,false);
            let value=self.paragraph(&value,Area{x,y:y+h*0.26,w,h:h*0.71},140.0,&color,600,false);
            shapes.push(reveal(fframes::svgr!(<g>{label}{value}</g>),self.progress(self.b.cue_seconds+i as f32*0.45),18.0));
        }
        let arrow=if self.wide{text("→",a.x+a.w*0.455,a.y+a.h*0.40,72.0,&self.p.muted,400)}else{text("↓",a.x+a.w*0.89,a.y+a.h*0.48,62.0,&self.p.muted,400)};
        let change=self.paragraph(s(p,"change"),Area{x:a.x,y:a.y+a.h*0.86,w:a.w,h:a.h*0.14},34.0,&self.p.ink.clone(),600,false);
        fframes::svgr!(<g>{shapes}{arrow}{change}</g>)
    }
    fn compare(&mut self)->Svgr<'a> {
        let a=self.area;let p=&self.b.props;let verdict=s(p,"verdict");let reserved=if verdict.is_empty(){0.0}else{90.0};let usable=a.h-reserved;
        let mut shapes=vec![];
        for (i,side) in [&p["left"],&p["right"]].iter().enumerate(){
            let (x,y,w,h)=if self.wide{(a.x+i as f32*a.w*0.53,a.y,a.w*0.47,usable)}else{(a.x,a.y+i as f32*usable*0.51,a.w,usable*0.47)};
            let accent=if i==0{self.p.muted.clone()}else{self.p.accent.clone()};
            let rule=rule(x,y,w,&accent);
            let title=self.paragraph(s(side,"title"),Area{x,y:y+18.0,w,h:h*0.23},44.0,&accent,600,false);
            let mut contents=vec![rule,title];let items=arr(side,"items");let rowh=h*0.64/items.len().max(1) as f32;
            for (j,item) in items.iter().enumerate(){
                let value=item.as_str().unwrap_or("");
                contents.push(self.paragraph(value,Area{x,y:y+h*0.32+j as f32*rowh,w,h:rowh*0.9},34.0,&self.p.ink.clone(),400,false));
            }
            shapes.push(reveal(fframes::svgr!(<g>{contents}</g>),self.progress(self.b.cue_seconds+i as f32*0.30),16.0));
        }
        let verdict=self.paragraph(verdict,Area{x:a.x,y:a.y+a.h-62.0,w:a.w,h:66.0},32.0,&self.p.accent.clone(),600,false);
        fframes::svgr!(<g>{shapes}{verdict}</g>)
    }
    fn sequence(&mut self,timeline:bool)->Svgr<'a> {
        let a=self.area;let items=arr(&self.b.props,"items");let count=items.len().max(1);let horizontal=self.wide && !timeline;
        let mut shapes=vec![];
        if horizontal {shapes.push(rect(a.x+20.0,a.y+35.0,a.w-40.0,2.0,&self.p.surface));}
        else {shapes.push(rect(a.x+19.0,a.y+20.0,2.0,a.h-80.0,&self.p.surface));}
        for (i,item) in items.iter().enumerate(){
            let (x,y,w,h)=if horizontal{(a.x+i as f32*a.w/count as f32,a.y,a.w/count as f32-38.0,a.h)}else{(a.x,a.y+i as f32*a.h/count as f32,a.w,a.h/count as f32)};
            let progress=self.progress(at(item,self.b.cue_seconds,i));
            let marker=if timeline {fframes::svgr!(<circle cx={x+20.0} cy={y+28.0} r="10" fill={self.p.accent.clone()} />)}else{
                let disk=fframes::svgr!(<circle cx={x+28.0} cy={y+29.0} r="27" fill={self.p.accent.clone()} />);
                let label=text(format!("{}",i+1),x+18.0,y+40.0,28.0,&self.p.bg,600);fframes::svgr!(<g>{disk}{label}</g>)
            };
            let has_time=timeline && !s(item,"label").is_empty() && !s(item,"title").is_empty();
            let timew=if has_time{if self.wide{180.0}else{130.0}}else{0.0};
            let time_label=if has_time{self.paragraph(s(item,"label"),Area{x:x+64.0,y,w:timew-20.0,h:h*0.44},29.0,&self.p.accent.clone(),600,false)}else{fframes::svgr!(<g />)};
            let tx=if horizontal{x}else{x+76.0+timew};let ty=if horizontal{y+89.0}else{y};let tw=if horizontal{w}else{w-76.0-timew};
            let label=nonempty(s(item,"title"),s(item,"label"));
            let headline=self.paragraph(label,Area{x:tx,y:ty,w:tw,h:if horizontal{h*0.25}else{h*0.36}},if horizontal{40.0}else{36.0},&self.p.ink.clone(),600,false);
            let detail=self.paragraph(s(item,"detail"),Area{x:tx,y:ty+if horizontal{h*0.30}else{h*0.39},w:tw,h:if horizontal{h*0.48}else{h*0.43}},30.0,&self.p.muted.clone(),400,false);
            shapes.push(reveal(fframes::svgr!(<g>{marker}{time_label}{headline}{detail}</g>),progress,14.0));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn funnel(&mut self)->Svgr<'a> {
        let a=self.area;let items=arr(&self.b.props,"items");let max=items.iter().map(|i|n(i,"value",0.0)).fold(0.0,f64::max).max(1e-9);
        let rowh=a.h/items.len().max(1) as f32;let plotw=if self.wide{a.w*0.55}else{a.w*0.52};let mut shapes=vec![];
        for(i,item)in items.iter().enumerate(){
            let value=n(item,"value",0.0);let y=a.y+i as f32*rowh;let progress=self.progress(self.b.cue_seconds+i as f32*0.18);
            let width=plotw*zero_scale(value,max) as f32*progress;let left=a.x+(plotw-width)/2.0;
            let bar=rect(left,y,width,rowh*0.76,&self.p.accent);
            let title=self.paragraph(s(item,"label"),Area{x:a.x+plotw+35.0,y,w:a.w-plotw-35.0,h:rowh*0.42},34.0,&self.p.ink.clone(),600,false);
            let number=self.paragraph(&format_with(value,&self.b.props["format"]),Area{x:a.x+plotw+35.0,y:y+rowh*0.44,w:a.w-plotw-35.0,h:rowh*0.36},30.0,&self.p.muted.clone(),400,false);
            shapes.push(fframes::svgr!(<g>{bar}{title}{number}</g>));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn quote(&mut self)->Svgr<'a> {
        let a=self.area;let p=&self.b.props;
        let mark=text("“",a.x-8.0,a.y+72.0,150.0,&self.p.accent,600);
        let quote=self.paragraph(s(p,"text"),Area{x:a.x+55.0,y:a.y+35.0,w:a.w-55.0,h:a.h*0.65},if self.wide{72.0}else{60.0},&self.p.ink.clone(),400,false);
        let author=self.paragraph(s(p,"author"),Area{x:a.x+55.0,y:a.y+a.h*0.76,w:a.w-55.0,h:a.h*0.10},30.0,&self.p.accent.clone(),600,false);
        let role=self.paragraph(s(p,"role"),Area{x:a.x+55.0,y:a.y+a.h*0.88,w:a.w-55.0,h:a.h*0.10},26.0,&self.p.muted.clone(),400,false);
        fframes::svgr!(<g>{mark}{quote}{author}{role}</g>)
    }
    fn list(&mut self)->Svgr<'a> {
        let a=self.area;let items=arr(&self.b.props,"items");let rowh=a.h/items.len().max(1) as f32;let mut shapes=vec![];
        for(i,item)in items.iter().enumerate(){
            let y=a.y+i as f32*rowh;let p=self.progress(at(item,self.b.cue_seconds,i));
            let index=text(format!("{:02}",i+1),a.x,y+44.0,30.0,&self.p.accent,600);
            let line=rule(a.x,y,a.w,&self.p.surface);
            let title=self.paragraph(nonempty(s(item,"text"),item.as_str().unwrap_or("")),Area{x:a.x+94.0,y:y+12.0,w:a.w-94.0,h:rowh-28.0},42.0,&self.p.ink.clone(),400,false);
            shapes.push(reveal(fframes::svgr!(<g>{line}{index}{title}</g>),p,16.0));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn matrix(&mut self)->Svgr<'a> {
        let a=self.area;let p=&self.b.props;let columns=arr(p,"columns");let rows=arr(p,"rows");let first=a.w*0.28;let colw=(a.w-first)/columns.len().max(1) as f32;let rowh=a.h/(rows.len()+1) as f32;let mut shapes=vec![];
        shapes.push(rect(a.x,a.y,a.w,rowh,&self.p.surface));
        for(i,col)in columns.iter().enumerate(){shapes.push(self.paragraph(col.as_str().unwrap_or(""),Area{x:a.x+first+i as f32*colw+14.0,y:a.y+12.0,w:colw-28.0,h:rowh-24.0},30.0,&self.p.ink.clone(),600,false));}
        for(i,row)in rows.iter().enumerate(){
            let y=a.y+(i+1)as f32*rowh;let mut cells=vec![rule(a.x,y+rowh,a.w,&self.p.surface)];
            cells.push(self.paragraph(s(row,"label"),Area{x:a.x+12.0,y:y+15.0,w:first-24.0,h:rowh-30.0},29.0,&self.p.ink.clone(),600,false));
            for(j,value)in arr(row,"values").iter().enumerate(){cells.push(self.paragraph(value.as_str().unwrap_or(""),Area{x:a.x+first+j as f32*colw+14.0,y:y+15.0,w:colw-28.0,h:rowh-30.0},29.0,&self.p.muted.clone(),400,false));}
            shapes.push(reveal(fframes::svgr!(<g>{cells}</g>),self.progress(self.b.cue_seconds+i as f32*0.12),10.0));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn equation(&mut self)->Svgr<'a> {
        let a=self.area;let p=&self.b.props;
        let expression=self.paragraph(s(p,"expression"),Area{x:a.x,y:a.y,w:a.w,h:a.h*0.28},80.0,&self.p.muted.clone(),400,false);
        let line=rule(a.x,a.y+a.h*0.35,a.w,&self.p.surface);
        let result=self.paragraph(s(p,"result"),Area{x:a.x,y:a.y+a.h*0.40,w:a.w,h:a.h*0.30},104.0,&self.p.accent.clone(),600,false);
        let result=reveal(result,self.progress(self.b.cue_seconds+0.55),18.0);
        let why=self.paragraph(s(p,"explanation"),Area{x:a.x,y:a.y+a.h*0.79,w:a.w,h:a.h*0.19},32.0,&self.p.ink.clone(),400,false);
        fframes::svgr!(<g>{expression}{line}{result}{why}</g>)
    }
    fn callout(&mut self)->Svgr<'a> {
        let a=self.area;let p=&self.b.props;let rule=rect(a.x,a.y,7.0,a.h*0.83,&self.p.accent);
        let label=self.paragraph(s(p,"label"),Area{x:a.x+44.0,y:a.y,w:a.w-44.0,h:a.h*0.13},28.0,&self.p.accent.clone(),600,false);
        let value=self.paragraph(s(p,"text"),Area{x:a.x+44.0,y:a.y+a.h*0.18,w:a.w-44.0,h:a.h*0.48},if self.wide{82.0}else{68.0},&self.p.ink.clone(),600,false);
        let support=self.paragraph(s(p,"support"),Area{x:a.x+44.0,y:a.y+a.h*0.72,w:a.w-44.0,h:a.h*0.21},32.0,&self.p.muted.clone(),400,false);
        fframes::svgr!(<g>{rule}{label}{value}{support}</g>)
    }
    fn endcard(&mut self)->Svgr<'a> {
        let a=self.area;let p=&self.b.props;
        let title=self.paragraph(nonempty(s(p,"title"),s(p,"text")),Area{x:a.x,y:a.y,w:a.w,h:a.h*0.45},if self.wide{106.0}else{86.0},&self.p.ink.clone(),600,false);
        let support=self.paragraph(s(p,"support"),Area{x:a.x,y:a.y+a.h*0.51,w:a.w,h:a.h*0.23},36.0,&self.p.muted.clone(),400,false);
        let rule=rule(a.x,a.y+a.h*0.83,a.w,&self.p.accent);
        let action=self.paragraph(s(p,"action"),Area{x:a.x,y:a.y+a.h*0.88,w:a.w,h:a.h*0.11},32.0,&self.p.accent.clone(),600,false);
        fframes::svgr!(<g>{title}{support}{rule}{action}</g>)
    }
    fn media(&mut self,video:bool)->Svgr<'a> {
        let a=self.area;let p=&self.b.props;let key=s(p,"file");let box_h=a.h-85.0;
        let image=if video {
            let media_frame=media_frame_at(&self.f,n(p,"offset",n(p,"start",0.0)));
            media_frame.get_synced_video_frame(self.ctx,key,&SyncVideoFrameInput{start_from:0.0,looping:p.get("loop").and_then(Value::as_bool).unwrap_or(false),editor_fallback_image:None}).map(|fr|fr.into_image().href())
        }else{self.ctx.get_image(key).map(|im|im.href())};
        let image=image.unwrap_or_else(||panic!("missing or undecodable prepared {}: {}",if video{"video"}else{"image"},key));
        let plate=fframes::svgr!(<image x={a.x} y={a.y} width={a.w} height={box_h} preserveAspectRatio="xMidYMid meet" href={image} />);
        let label=self.paragraph(s(p,"label"),Area{x:a.x,y:a.y-42.0,w:a.w,h:34.0},24.0,&self.p.accent.clone(),600,false);
        let caption=self.paragraph(s(p,"caption"),Area{x:a.x,y:a.y+box_h+20.0,w:a.w,h:65.0},28.0,&self.p.muted.clone(),400,false);
        fframes::svgr!(<g>{label}{plate}{caption}</g>)
    }
    fn word_layout(&mut self,words:&[Caption],box_:Area,fontsize:f32,mode:&str,center:bool,max_words:usize,max_gap:f32,max_duration:f32)->Svgr<'a> {
        if words.is_empty(){return fframes::svgr!(<g />);}
        let current=active_word(words,self.t);
        if mode=="word" {
            if let Some(i)=current {return self.paragraph(&words[i].text,box_,fontsize*1.3,&self.p.accent.clone(),600,center);}
            return fframes::svgr!(<g />);
        }
        let window=word_window(words,self.t,max_words,max_gap,max_duration);let start=window.start;let chunk=&words[window];
        let mut size=fontsize;let mut lines:Vec<Vec<(usize,f32)>>;
        loop {
            lines=vec![vec![]];let mut width=0.0;let space=self.width(" ",size,600);
            let mut too_wide=false;
            for(i,word)in chunk.iter().enumerate(){
                let word_width=self.width(&word.text,size,600);
                if word_width>box_.w {too_wide=true;}
                if width+word_width>box_.w && !lines.last().unwrap().is_empty(){lines.push(vec![]);width=0.0;}
                lines.last_mut().unwrap().push((i,word_width));width+=word_width+space;
            }
            if size<=18.0 || (!too_wide && lines.len() as f32*size*1.30<=box_.h){break;}
            size-=1.0;
        }
        let mut shapes=vec![];let space=self.width(" ",size,600);let total_height=lines.len() as f32*size*1.30;
        for(line_index,line)in lines.iter().enumerate(){
            let line_width=line.iter().map(|(_,w)|w).sum::<f32>()+space*line.len().saturating_sub(1) as f32;
            let mut x=box_.x+if center{(box_.w-line_width)/2.0}else{0.0};
            let y=box_.y+(box_.h-total_height)/2.0+size+line_index as f32*size*1.30;
            for &(i,width) in line {
                let word=&chunk[i];let active=current==Some(start+i);let visible=mode!="reveal" || self.t>=word.start;
                let color=if active{self.p.accent.clone()}else if mode=="reveal"{self.p.ink.clone()}else{self.p.muted.clone()};
                if visible{shapes.push(text(word.text.clone(),x,y,size,&color,600));}
                x+=width+space;
            }
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn kinetic(&mut self)->Svgr<'a> {
        let p=&self.b.props;let a=self.area;let words=self.b.words.clone();
        self.word_layout(&words,a,if self.wide{108.0}else{88.0},nonempty(s(p,"mode"),"highlight"),s(p,"align")=="center",n(p,"maxWords",7.0) as usize,n(p,"maxGap",0.6) as f32,n(p,"maxDuration",4.0) as f32)
    }
    fn footer(&mut self)->Svgr<'a> {
        let env=&self.b.environment;let vertical=env.height>env.width;let source_y=env.height-if env.captions{if vertical{320.0}else{160.0}}else{92.0};
        let source=self.paragraph(s(&self.b.props,"source"),Area{x:self.area.x,y:source_y,w:self.area.w,h:66.0},22.0,&self.p.muted.clone(),400,false);
        let mut captions=fframes::svgr!(<g />);
        if env.captions && self.b.block!="kinetic" {
            let box_=Area{x:self.area.x,y:env.height-if vertical{242.0}else{104.0},w:self.area.w,h:if vertical{112.0}else{78.0}};
            if !self.b.words.is_empty(){let words=self.b.words.clone();captions=self.word_layout(&words,box_,34.0,"highlight",true,if self.wide{12}else{7},0.6,4.0);}
            else if let Some(cue)=self.b.captions.iter().find(|c|self.t>=c.start && self.t<c.end){captions=self.paragraph(&cue.text,box_,32.0,&self.p.ink.clone(),600,true);}
        }
        fframes::svgr!(<g>{source}{captions}</g>)
    }
}

pub fn render<'a>(b:&'a Beat,frame:Frame,ctx:&FFramesContext<'a,'_>)->Svgr<'a> {
    let env=&b.environment;let wide=env.width/env.height>1.3;let x=if wide{120.0}else{86.0};
    let bottom=if env.captions{if env.height>env.width{365.0}else{215.0}}else{145.0};
    let hero=matches!(b.block.as_str(),"title"|"statement"|"endcard");
    let portrait_shift=if env.height>env.width{env.height*0.11-108.0}else{0.0};
    let top=if hero{235.0+portrait_shift}else{335.0+portrait_shift};
    let mut d=Draw{b,t:frame.seconds(),f:frame,ctx,p:Palette::from_theme(&env.theme),area:Area{x,y:top,w:env.width-x*2.0,h:env.height-top-bottom},wide};
    let header=if hero{fframes::svgr!(<g />)}else{d.header()};
    let body=match b.block.as_str(){
        "title"|"statement"=>d.hero(),"stat"=>d.stat(),"kpis"=>d.kpis(),"bars"=>d.bars(),"line"=>d.line(),
        "waffle"=>d.waffle(),"ring"=>d.ring(),"delta"=>d.delta(),"compare"=>d.compare(),
        "steps"=>d.sequence(false),"timeline"=>d.sequence(true),"funnel"=>d.funnel(),"quote"=>d.quote(),
        "list"=>d.list(),"matrix"=>d.matrix(),"equation"=>d.equation(),"callout"=>d.callout(),
        "endcard"=>d.endcard(),"image"=>d.media(false),"video"=>d.media(true),"kinetic"=>d.kinetic(),
        "icon-grid"=>d.icon_grid(),"flow"=>d.flow(),"cycle"=>d.cycle(),"breathing"=>d.breathing(),
        _=>panic!("unsupported block {}",b.block),
    };
    let footer=d.footer();
    let enter=d.progress(0.0);let intensity=env.motion.intensity;
    let distance=24.0*intensity;
    let spring=if env.motion.preset=="spring"{let t=(d.t/0.72).clamp(0.0,1.0);1.0-(-7.0*t).exp()*(10.0*t).cos()}else{enter};
    let (opacity,transform)=match b.transition.as_str(){
        "fade"=>(enter,String::new()),"rise"=>(enter,format!("translate(0 {})",distance*(1.0-spring))),
        "push"=>(1.0,format!("translate({} 0)",env.width*(1.0-enter))),
        "zoom"=>{let scale=1.0-0.035*intensity*(1.0-spring);(enter,format!("translate({} {}) scale({scale})",env.width*(1.0-scale)/2.0,env.height*(1.0-scale)/2.0))},
        _=>(1.0,String::new()),
    };
    let clip=if b.transition=="wipe"{env.width*enter}else{env.width};
    if clip<=0.0 {return fframes::svgr!(<g>{footer}</g>);}
    fframes::svgr!(<g>
        <defs><clipPath id="scene-reveal"><rect x="0" y="0" width={clip} height={env.height} /></clipPath></defs>
        <g clip-path="url(#scene-reveal)" opacity={opacity} transform={transform}>{header}{body}</g>
        {footer}
    </g>)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn empty_paragraphs_emit_no_text_even_without_layout_space() {
        let beat:Beat=serde_json::from_value(serde_json::json!({"id":"empty","block":"statement","frames":60,
            "start_frame":0,"cue_seconds":0,"props":{"text":"Test"}})).unwrap();
        let ctx=FFramesContext{time_base:fframes::TimeBase{fps:30,sample_rate:48000},
            current_video_size:fframes::VideoSize{width:1920,height:1080},duration_in_frames:60,
            mode:fframes::FFramesMode::Renderer,scenes:None,media_source:None,font_source:None,abort_signal:None};
        let area=Area{x:0.0,y:0.0,w:0.0,h:0.0};
        let mut draw=Draw{b:&beat,f:Frame::new(0,0,30),ctx:&ctx,p:Palette::from_theme(&Value::Null),area,t:0.0,wide:true};
        for value in ["", " \n\t "] {
            let tree=format!("{:?}",draw.paragraph(value,area,32.0,"#000000",400,false));
            assert!(!tree.contains("text"),"empty input must not create a text element");
        }
    }
    #[test] fn dynamic_media_survives_nested_scene_svg() {
        let image=std::sync::Arc::new(fframes::usvgr::PreloadedImageData::new("test.mp4___frame___0.png".into(),1,1,&[40,80,160,255]));
        let plate=fframes::svgr!(<image x="10" y="10" width="80" height="80" href={image} />);
        let wrapped=fframes::svgr!(<g>{plate}</g>);
        let svg=fframes::svgr!(<svg width="100" height="100" viewBox="0 0 100 100">{wrapped}</svg>);
        let tree=svg.into_svg_tree(&Default::default(),&mut fframes::usvgr::Cache::new_with_text_cache(1),&Default::default()).unwrap();
        let serialized=tree.to_string(&Default::default());
        assert!(serialized.contains("<image"),"{serialized}");
    }
    #[test] fn media_offset_seeks_source_without_delaying_scene_or_global_clock(){
        let scene=Frame::new(15,315,30);let media=media_frame_at(&scene,2.0);
        assert_eq!(media.index,75);assert_eq!(media.global_index,315);assert_eq!(media.fps,30);
        assert_eq!(media_frame_at(&Frame::new(0,300,30),2.0).index,60);
        assert_eq!(scene.index,15);
    }
    #[test] fn signed_suffixes_are_atomic(){assert_eq!(format_number(-1234.5,1,"$"," million"),"−$1,234.5 million");assert_eq!(format_number(-0.0001,2,"","%"),"0.00%");assert_eq!(format_number(1e7,0,"",""),"10,000,000");}
    #[test] fn bars_have_truthful_zero_baselines(){assert_eq!(zero_scale(0.0,50.0),0.0);assert_eq!(zero_scale(25.0,50.0),0.5);assert_eq!(zero_scale(0.0,0.0),0.0);}
    #[test] fn palettes_accept_global_overrides(){let p=Palette::from_theme(&serde_json::json!({"base":"ink","accent":"#FF8800"}));assert_eq!(p.accent,"#FF8800");assert_eq!(p.bg,"#101721");}
    #[test] fn dense_and_irregular_axes_keep_endpoints_without_collisions(){
        let indices=axis_label_indices(&[0.0,0.1,0.2,4.0,8.0,10.0]);assert_eq!(indices,vec![0,3,4,5]);
        let dense=(0..40).map(|i|i as f64).collect::<Vec<_>>();let indices=axis_label_indices(&dense);
        assert_eq!(indices.first(),Some(&0));assert_eq!(indices.last(),Some(&39));assert!(indices.len()<=7);
    }
    #[test] fn words_follow_half_open_timestamps_and_seek_backwards(){
        let words=vec![Caption{text:"one".into(),start:0.1,end:0.5},Caption{text:"two".into(),start:0.6,end:1.0}];
        assert_eq!(active_word(&words,0.0),None);assert_eq!(active_word(&words,0.1),Some(0));
        assert_eq!(active_word(&words,0.5),None);assert_eq!(active_word(&words,0.6),Some(1));
        assert_eq!(active_word(&words,1.0),None);assert_eq!(active_word(&words,0.2),Some(0));
    }
    #[test] fn phrases_split_on_word_limit_silence_and_duration_without_changing_timestamps(){
        let words=vec![
            Caption{text:"Observe".into(),start:0.0,end:0.4}, Caption{text:"closely".into(),start:0.5,end:0.9},
            Caption{text:"Then".into(),start:2.0,end:2.3}, Caption{text:"begin".into(),start:2.4,end:2.8},
            Caption{text:"again".into(),start:2.9,end:3.4}];
        assert_eq!(word_window(&words,0.2,7,0.6,4.0),0..2);
        assert_eq!(word_window(&words,1.8,7,0.6,4.0),0..2);
        assert_eq!(active_word(&words,1.8),None);
        assert_eq!(word_window(&words,2.0,7,0.6,4.0),2..5);
        assert_eq!(word_window(&words,3.1,7,0.6,1.0),4..5);
        assert_eq!(word_window(&words,2.5,1,0.6,4.0),3..4);
        assert_eq!(word_window(&words,0.2,7,0.6,4.0),0..2);
        assert_eq!(words[2].start,2.0); assert_eq!(words[4].end,3.4);
    }
}
