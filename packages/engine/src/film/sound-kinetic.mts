import type { SoundContext } from './sound-contracts.mjs';

export function kineticSounds(ctx: SoundContext): void {
  const { b, level, start, add } = ctx;
  if (level === 'punchy' && b.block === 'kinetic' && b.props.mode === 'stack') {
    const keys = new Set(
      (b.props.emphasis ?? []).flatMap((e) =>
        String(e).toLowerCase().split(/\s+/),
      ),
    );
    for (const w of b.words)
      if (keys.has(w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')))
        add('tick', start + w.start, 0.2, 1);
  }
}
