//! Easing curves and the entrance/exit vocabulary. Every value is a pure function of
//! scene-local seconds, so seeking backwards reproduces the same frame.
use std::f32::consts::PI;

pub fn clamp01(x: f32) -> f32 {
    if x.is_nan() { 0.0 } else { x.clamp(0.0, 1.0) }
}
pub fn out_cubic(x: f32) -> f32 {
    1.0 - (1.0 - clamp01(x)).powi(3)
}
pub fn out_quart(x: f32) -> f32 {
    1.0 - (1.0 - clamp01(x)).powi(4)
}
pub fn out_expo(x: f32) -> f32 {
    let x = clamp01(x);
    if x >= 1.0 { 1.0 } else { 1.0 - 2f32.powf(-10.0 * x) }
}
pub fn in_out_cubic(x: f32) -> f32 {
    let x = clamp01(x);
    if x < 0.5 { 4.0 * x * x * x } else { 1.0 - (-2.0 * x + 2.0).powi(3) / 2.0 }
}
pub fn in_cubic(x: f32) -> f32 {
    clamp01(x).powi(3)
}
/// Critically under-damped spring that settles exactly on 1 at `x = 1`; peaks near 1.07.
pub fn spring(x: f32) -> f32 {
    let x = clamp01(x);
    if x >= 1.0 {
        return 1.0;
    }
    let raw = |t: f32| 1.0 - (-6.5 * t).exp() * (2.6 * PI * t).cos();
    raw(x) + (1.0 - raw(1.0)) * x
}
/// A smooth 0 → 1 → 0 bump used for pulses and highlights.
pub fn bump(x: f32) -> f32 {
    (PI * clamp01(x)).sin()
}

// Rate functions adapted from 3b1b/manim (MIT, Copyright (c) 2020-2026 3Blue1Brown LLC),
// manimlib/utils/rate_functions.py at fafa083a4fb274bba9cabde0b6e2f50ba6da0622 (see
// scene/native/THIRD_PARTY.md). Inputs are clamped to [0, 1]; "there and back" curves end where
// they began, so a key that uses one returns its element to the pose it started from.

/// Zero first and second derivatives at both ends: bezier([0, 0, 0, 1, 1, 1]).
pub fn smooth(t: f32) -> f32 {
    let t = clamp01(t);
    let s = 1.0 - t;
    t * t * t * (10.0 * s * s + 5.0 * s * t + t * t)
}
/// A one-dimensional Bézier curve through `points` (Bernstein form).
fn bezier(points: &[f32], t: f32) -> f32 {
    let n = points.len() - 1;
    let mut binom = 1.0f32;
    let mut sum = 0.0f32;
    for (k, p) in points.iter().enumerate() {
        sum += binom * t.powi(k as i32) * (1.0 - t).powi((n - k) as i32) * p;
        binom = binom * (n - k) as f32 / (k + 1) as f32;
    }
    sum
}
/// The named rate functions, by the name a key, route or entrance uses.
pub fn named(name: &str, x: f32) -> Option<f32> {
    let t = clamp01(x);
    Some(match name {
        "smooth" => smooth(t),
        "rushInto" => 2.0 * smooth(0.5 * t),
        "rushFrom" => 2.0 * smooth(0.5 * (t + 1.0)) - 1.0,
        "slowInto" => (1.0 - (1.0 - t) * (1.0 - t)).sqrt(),
        "doubleSmooth" => if t < 0.5 { 0.5 * smooth(2.0 * t) } else { 0.5 * (1.0 + smooth(2.0 * t - 1.0)) },
        "thereAndBack" => smooth(if t < 0.5 { 2.0 * t } else { 2.0 * (1.0 - t) }),
        "thereAndBackPause" => {
            let (p, a) = (1.0 / 3.0, 2.0 / (1.0 - 1.0 / 3.0));
            if t < 0.5 - p / 2.0 { smooth(a * t) } else if t < 0.5 + p / 2.0 { 1.0 } else { smooth(a - a * t) }
        }
        "runningStart" => bezier(&[0.0, 0.0, -0.5, -0.5, 1.0, 1.0, 1.0], t),
        "overshoot" => bezier(&[0.0, 0.0, 1.5, 1.5, 1.0, 1.0], t),
        "wiggle" => smooth(if t < 0.5 { 2.0 * t } else { 2.0 * (1.0 - t) }) * (2.0 * PI * t).sin(),
        "lingering" => if t > 0.8 { 1.0 } else { t / 0.8 },
        "decay" => 1.0 - (-t / 0.1).exp(),
        _ => return None,
    })
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Preset {
    Gentle,
    Snappy,
    Spring,
}

#[derive(Clone, Copy, Debug)]
pub struct MotionStyle {
    pub preset: Preset,
    pub intensity: f32,
}

/// Entrance state: `alpha` for opacity and `travel` for position/scale, which may
/// overshoot 1 with the spring preset while opacity never does.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Enter {
    pub alpha: f32,
    pub travel: f32,
}
impl Enter {
    pub const DONE: Enter = Enter { alpha: 1.0, travel: 1.0 };
    pub fn hidden(&self) -> bool {
        self.alpha <= 0.001
    }
    pub fn done(&self) -> bool {
        self.alpha >= 0.999 && (self.travel - 1.0).abs() < 0.001
    }
}

impl MotionStyle {
    pub fn new(preset: &str, intensity: f32) -> Self {
        let preset = match preset {
            "snappy" => Preset::Snappy,
            "spring" => Preset::Spring,
            _ => Preset::Gentle,
        };
        Self { preset, intensity: clamp01(intensity) }
    }
    /// Nominal element entrance. `production.mjs` schedules dense arrivals with the same values.
    pub fn duration(&self) -> f32 {
        crate::constants::get().entrance[self.name()]
    }
    fn name(&self) -> &'static str {
        match self.preset {
            Preset::Snappy => "snappy",
            Preset::Spring => "spring",
            Preset::Gentle => "gentle",
        }
    }
    /// Seconds between staggered siblings (lines of a headline, cards in a row).
    pub fn stagger(&self) -> f32 {
        crate::constants::get().stagger[self.name()]
    }
    /// Travel distance scale: intensity 0 keeps fades only, 1 is the full move.
    pub fn distance(&self, base: f32) -> f32 {
        base * self.intensity
    }
    pub fn enter(&self, elapsed: f32) -> Enter {
        self.enter_over(elapsed, self.duration())
    }
    pub fn enter_over(&self, elapsed: f32, duration: f32) -> Enter {
        if duration <= 0.0 {
            return if elapsed >= 0.0 { Enter::DONE } else { Enter { alpha: 0.0, travel: 0.0 } };
        }
        let x = elapsed / duration;
        let alpha = out_cubic(x * 1.35);
        let travel = match self.preset {
            Preset::Snappy => out_expo(x),
            Preset::Spring => spring(x),
            Preset::Gentle => out_quart(x),
        };
        Enter { alpha, travel }
    }
    /// A value animation (counters, bar growth, drawn lines): no overshoot, so charts
    /// never momentarily exceed their data.
    pub fn grow(&self, elapsed: f32, duration: f32) -> f32 {
        if duration <= 0.0 {
            return if elapsed >= 0.0 { 1.0 } else { 0.0 };
        }
        match self.preset {
            Preset::Snappy => out_expo(elapsed / duration),
            _ => out_cubic(elapsed / duration),
        }
    }
    /// Scale pop for markers and badges; springs overshoot, others settle.
    pub fn pop(&self, elapsed: f32) -> f32 {
        let x = elapsed / self.duration();
        match self.preset {
            Preset::Spring => spring(x),
            Preset::Snappy => out_expo(x),
            Preset::Gentle => out_quart(x),
        }
    }
}

/// How a scene leaves before the next one enters. Mirrors the incoming transition.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ExitKind {
    None,
    Fade,
    Push,
    Zoom,
    Wipe,
    Panel,
    Iris,
    Whip,
}
impl ExitKind {
    pub fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "none" => Self::None,
            "fade" => Self::Fade,
            "push" => Self::Push,
            "zoom" => Self::Zoom,
            "wipe" => Self::Wipe,
            "panel" => Self::Panel,
            "iris" => Self::Iris,
            "whip" => Self::Whip,
            _ => return None,
        })
    }
    /// Graphic transitions cover the cut: the exit must finish, so it may start a little
    /// earlier than a fade would. `production.mjs` mirrors these seconds.
    pub fn cover_seconds(self) -> Option<f32> {
        let key = match self {
            Self::Panel => "panel",
            Self::Iris => "iris",
            Self::Whip => "whip",
            _ => return None,
        };
        Some(crate::constants::get().cover[key][0])
    }
}
/// Seconds the incoming half of a graphic transition takes.
pub fn reveal_seconds(kind: &str) -> f32 {
    crate::constants::get().cover.get(kind).map_or(0.0, |c| c[1])
}

/// Exit progress 0 → 1 over the final `duration` seconds, never before `earliest`
/// (the end of the last spoken word) so speech-following text is not faded early.
pub fn cover_progress(time: f32, scene_seconds: f32, duration: f32, earliest: f32) -> f32 {
    // A cover must complete at the cut; if speech runs late it compresses, never skips.
    let start = (scene_seconds - duration).max(earliest).min(scene_seconds - 0.12);
    in_cubic((time - start) / (scene_seconds - start))
}

pub fn exit_progress(time: f32, scene_seconds: f32, duration: f32, earliest: f32) -> f32 {
    let start = (scene_seconds - duration).max(earliest);
    let span = scene_seconds - start;
    // A squeezed exit would read as a flash; cut cleanly instead.
    if span < 0.12 {
        return 0.0;
    }
    in_cubic((time - start) / span)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn manim_rate_functions_keep_their_defining_shapes() {
        let f = |n: &str, x: f32| named(n, x).unwrap();
        for n in ["smooth", "rushInto", "rushFrom", "slowInto", "doubleSmooth", "runningStart", "overshoot", "lingering"] {
            assert!(f(n, 0.0).abs() < 1e-5 && (f(n, 1.0) - 1.0).abs() < 1e-5, "{n} runs 0 → 1");
        }
        for n in ["thereAndBack", "thereAndBackPause", "wiggle"] {
            assert!(f(n, 0.0).abs() < 1e-5 && f(n, 1.0).abs() < 1e-5, "{n} returns to where it began");
        }
        assert!((f("smooth", 0.5) - 0.5).abs() < 1e-6 && (f("thereAndBack", 0.5) - 1.0).abs() < 1e-6);
        assert!(f("thereAndBackPause", 0.45) == 1.0, "the pause holds at the top");
        assert!(f("runningStart", 0.2) < 0.0, "a running start pulls back first");
        assert!((0..100).any(|i| f("overshoot", i as f32 / 100.0) > 1.0), "overshoot passes its target");
        assert!(f("decay", 1.0) > 0.9999 && named("nope", 0.5).is_none());
    }
    #[test]
    fn curves_start_at_zero_end_at_one_and_clamp() {
        for curve in [out_cubic, out_quart, out_expo, in_out_cubic, in_cubic, spring] {
            assert_eq!(curve(-1.0), 0.0);
            assert!((curve(0.0)).abs() < 1e-6);
            assert!((curve(1.0) - 1.0).abs() < 1e-6);
            assert!((curve(4.0) - 1.0).abs() < 1e-6);
        }
        assert_eq!(out_cubic(f32::NAN), 0.0);
    }
    #[test]
    fn spring_overshoots_travel_but_never_opacity() {
        let motion = MotionStyle::new("spring", 1.0);
        let peak = (0..=100).map(|i| motion.enter(i as f32 / 100.0 * 0.72).travel).fold(0.0, f32::max);
        assert!(peak > 1.02 && peak < 1.12, "peak {peak}");
        assert!((0..=100).all(|i| motion.enter(i as f32 / 100.0).alpha <= 1.0));
        assert!((0..=100).all(|i| motion.grow(i as f32 / 100.0, 1.0) <= 1.0), "values never overshoot");
    }
    #[test]
    fn entrances_complete_within_the_nominal_duration_for_scheduling() {
        for preset in ["gentle", "snappy", "spring"] {
            let motion = MotionStyle::new(preset, 0.65);
            assert!(motion.enter(motion.duration()).done(), "{preset}");
            assert!(motion.enter(-0.01).hidden());
        }
    }
    #[test]
    fn exits_wait_for_the_last_word_and_skip_when_there_is_no_room() {
        assert_eq!(exit_progress(3.5, 4.0, 0.3, 0.0), 0.0);
        let late = exit_progress(3.9, 4.0, 0.3, 0.0);
        assert!(late > 0.2 && late < 1.0, "ease-in exit accelerates toward the cut: {late}");
        assert!(exit_progress(3.8, 4.0, 0.3, 0.0) < late);
        assert_eq!(exit_progress(3.9, 4.0, 0.3, 3.95), 0.0);
        assert_eq!(exit_progress(3.99, 4.0, 0.3, 4.0), 0.0);
    }
}
