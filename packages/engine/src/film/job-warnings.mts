import type {
  ResolvedStoryboard as Storyboard,
  Timing,
} from '../engine/domain.mjs';
import type { JobReport, Theme } from './types.mjs';

export function filmWarnings(
  sb: Storyboard,
  timing: Timing,
  theme: Theme,
  { warnings }: JobReport,
) {
  const luminance = (hex: string): number => {
    const rgb = hex
      .slice(1)
      .match(/../g)
      ?.map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    if (!rgb || rgb.length !== 3) throw new Error('Invalid palette color');
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const contrast = (a: string, b: string): number => {
    const x = luminance(a),
      y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  for (const key of ['ink', 'muted', 'accent'] as const)
    if (contrast(theme[key], theme.bg) < 4.5)
      warnings.push(
        `Palette ${key} has low text contrast against bg; review small text at delivery size.`,
      );
  if (contrast(theme.accent2, theme.bg) < 3)
    warnings.push(
      'Palette accent2 has low graphic contrast (< 3:1) against bg; second series and chart segments may be hard to see.',
    );
  const generated = timing.beats
    .filter(
      (b) =>
        b.block === 'video' &&
        sb.assets.some((a) => a.id === b.props?.asset && !a.file),
    )
    .reduce((n, b) => n + b.dur, 0);
  if (generated > timing.duration * (sb.continuity?.maxGeneratedShare ?? 0.2))
    warnings.push(
      'Generated footage exceeds the configured runtime share (default 20%); use native graphics where they carry the story.',
    );
}
