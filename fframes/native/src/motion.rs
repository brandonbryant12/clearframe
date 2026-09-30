//! Easing curves and the entrance/exit vocabulary. Every value is a pure function of
//! scene-local seconds, so seeking backwards reproduces the same frame.
use std::f32::consts::PI;

pub fn clamp01(x: f32) -> f32 { if x.is_nan() { 0.0 } else { x.clamp(0.0, 1.0) } }
pub fn out_cubic(x: f32) -> f32 { 1.0 - (1.0 - clamp01(x)).powi(3) }
pub fn out_quart(x: f32) -> f32 { 1.0 - (1.0 - clamp01(x)).powi(4) }
pub fn out_expo(x: f32) -> f32 { let x = clamp01(x); if x >= 1.0 { 1.0 } else { 1.0 - 2f32.powf(-10.0 * x) } }
pub fn in_out_cubic(x: f32) -> f32 {
    let x = clamp01(x);
    if x < 0.5 { 4.0 * x * x * x } else { 1.0 - (-2.0 * x + 2.0).powi(3) / 2.0 }
}
pub fn in_cubic(x: f32) -> f32 { clamp01(x).powi(3) }
/// Critically under-damped spring that settles exactly on 1 at `x = 1`; peaks near 1.07.
pub fn spring(x: f32) -> f32 {
    let x = clamp01(x);
    if x >= 1.0 { return 1.0; }
    let raw = |t: f32| 1.0 - (-6.5 * t).exp() * (2.6 * PI * t).cos();
    raw(x) + (1.0 - raw(1.0)) * x
}
/// A smooth 0 → 1 → 0 bump used for pulses and highlights.
pub fn bump(x: f32) -> f32 { (PI * clamp01(x)).sin() }

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Preset { Gentle, Snappy, Spring }

#[derive(Clone, Copy, Debug)]
pub struct MotionStyle { pub preset: Preset, pub intensity: f32 }

/// Entrance state: `alpha` for opacity and `travel` for position/scale, which may
/// overshoot 1 with the spring preset while opacity never does.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Enter { pub alpha: f32, pub travel: f32 }
impl Enter {
    pub const DONE: Enter = Enter { alpha: 1.0, travel: 1.0 };
    pub fn hidden(&self) -> bool { self.alpha <= 0.001 }
    pub fn done(&self) -> bool { self.alpha >= 0.999 && (self.travel - 1.0).abs() < 0.001 }
}

impl MotionStyle {
    pub fn new(preset: &str, intensity: f32) -> Self {
        let preset = match preset { "snappy" => Preset::Snappy, "spring" => Preset::Spring, _ => Preset::Gentle };
        Self { preset, intensity: clamp01(intensity) }
    }
    /// Nominal element entrance. `production.mjs` schedules dense arrivals with the same values.
    pub fn duration(&self) -> f32 { match self.preset { Preset::Snappy => 0.30, Preset::Spring => 0.72, Preset::Gentle => 0.55 } }
    /// Seconds between staggered siblings (lines of a headline, cards in a row).
    pub fn stagger(&self) -> f32 { match self.preset { Preset::Snappy => 0.05, Preset::Spring => 0.08, Preset::Gentle => 0.09 } }
    /// Travel distance scale: intensity 0 keeps fades only, 1 is the full move.
    pub fn distance(&self, base: f32) -> f32 { base * self.intensity }
    pub fn enter(&self, elapsed: f32) -> Enter { self.enter_over(elapsed, self.duration()) }
    pub fn enter_over(&self, elapsed: f32, duration: f32) -> Enter {
        if duration <= 0.0 { return if elapsed >= 0.0 { Enter::DONE } else { Enter { alpha: 0.0, travel: 0.0 } }; }
        let x = elapsed / duration;
        let alpha = out_cubic(x * 1.35);
        let travel = match self.preset { Preset::Snappy => out_expo(x), Preset::Spring => spring(x), Preset::Gentle => out_quart(x) };
        Enter { alpha, travel }
    }
    /// A value animation (counters, bar growth, drawn lines): no overshoot, so charts
    /// never momentarily exceed their data.
    pub fn grow(&self, elapsed: f32, duration: f32) -> f32 {
        if duration <= 0.0 { return if elapsed >= 0.0 { 1.0 } else { 0.0 }; }
        match self.preset { Preset::Snappy => out_expo(elapsed / duration), _ => out_cubic(elapsed / duration) }
    }
    /// Scale pop for markers and badges; springs overshoot, others settle.
    pub fn pop(&self, elapsed: f32) -> f32 {
        let x = elapsed / self.duration();
        match self.preset { Preset::Spring => spring(x), Preset::Snappy => out_expo(x), Preset::Gentle => out_quart(x) }
    }
}

/// How a scene leaves before the next one enters. Mirrors the incoming transition.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ExitKind { None, Fade, Push, Zoom, Wipe, Panel, Iris, Whip }
impl ExitKind {
    pub fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "none" => Self::None, "fade" => Self::Fade, "push" => Self::Push, "zoom" => Self::Zoom, "wipe" => Self::Wipe,
            "panel" => Self::Panel, "iris" => Self::Iris, "whip" => Self::Whip, _ => return None,
        })
    }
    /// Graphic transitions cover the cut: the exit must finish, so it may start a little
    /// earlier than a fade would. `production.mjs` mirrors these seconds.
    pub fn cover_seconds(self) -> Option<f32> {
        match self { Self::Panel => Some(0.42), Self::Iris => Some(0.5), Self::Whip => Some(0.24), _ => None }
    }
}
/// Seconds the incoming half of a graphic transition takes.
pub fn reveal_seconds(kind: &str) -> f32 {
    match kind { "panel" => 0.5, "iris" => 0.55, "whip" => 0.3, _ => 0.0 }
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
    if span < 0.12 { return 0.0; }
    in_cubic((time - start) / span)
}

#[cfg(test)]
mod tests {
    use super::*;
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
