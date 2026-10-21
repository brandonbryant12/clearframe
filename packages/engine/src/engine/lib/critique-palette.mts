import { palette } from '../../film/catalog.mjs';

import type { CritiqueContext } from './critique-contracts.mjs';

export function checkPalette(ctx: CritiqueContext) {
  const { sb, add } = ctx;
  // A warning in the brand's own colour: meridian's accent and its warning red are one red, so a
  // phishing film's marks read as decoration (a round-18 Opus film); meadow's accent is its positive.
  try {
    const pal = typeof sb.theme === 'string' ? palette(sb.theme) : null;
    const lab = (hex: string): number[] => {
      const c = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
      const [x, y, z] = [
        (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047,
        0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2],
        (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883,
      ].map((v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116));
      return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
    };
    const near = (a: string, b: string): boolean =>
      Math.hypot(...lab(a).map((v, i) => v - lab(b)[i])) < 12;
    const said = JSON.stringify(sb.beats);
    const warns =
      /"negative"/.test(said) ||
      /"sketch":"inspect"/.test(said.replace(/\s/g, ''));
    for (const [role, used] of [
      ['negative', warns],
      ['positive', /"positive"/.test(said)],
    ] as const)
      if (
        pal &&
        used &&
        /^#[0-9a-f]{6}$/i.test(pal.accent) &&
        /^#[0-9a-f]{6}$/i.test(pal[role]) &&
        near(pal.accent, pal[role])
      )
        add(
          'warn',
          'film',
          `In the ${sb.theme} palette the accent and the ${role} colour are the same ${pal.accent} / ${pal[role]}, so ${role === 'negative' ? 'warning marks read as the brand colour' : 'what is good reads as the brand colour'}. Choose a palette that tells them apart (briefing for security and policy films), or mark them in another colour.`,
        );
  } catch {}
  frameConventions(ctx);
}
function frameConventions({ sb, add }: CritiqueContext): void {
  // A trailer's punctuation in a calm film: a flat field of the accent colour sweeping over the
  // picture reads as a rendering fault (a round-18 phishing film's reviewer took it for a bug).
  if (sb.treatment === 'workplace')
    for (const b of sb.beats)
      if (b.transition === 'panel')
        add(
          'warn',
          b.id,
          `transition "panel" covers the picture with a flat slab of colour (reviewers read it as a rendering fault in a workplace film): cut, fade, "push" at a chapter, or move the camera within one world.`,
        );
  // "Portrait" is read as "vertical": two onboarding films for a phone app came out 4:5.
  if (sb.format?.preset === 'portrait')
    add(
      'warn',
      'film',
      'The format is portrait: 4:5 (1080×1350), a feed post. A film for a phone screen (an app, Reels, Stories, TikTok, "vertical") is format.preset "vertical": 9:16 (1080×1920).',
    );
}
