import { workingTimeline } from './revisions.mjs';
import { readNotes, formatTime, locate } from './notes.mjs';

import { checkId } from './store.mjs';
import type { ReviewContext } from './review-command-contracts.mjs';
import { rel, list, rangeOf, json } from './review-command-common.mjs';
export async function rangeCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o } = ctx;

  const { renderRange } = await import('../../film/render.mjs');

  let beats = list(o.beats);

  let span = o.range ? rangeOf(o) : {};

  if (o.note) {
    const n = readNotes(dir).find((x) => x.id === checkId('note', o.note));
    if (!n) throw new Error(`No note ${o.note}.`);
    const { timeline } = await workingTimeline(dir);
    const where = locate(dir, n, { id: null, timeline });
    if (!where.beat)
      throw new Error(`Note ${n.id} is ${where.state}: ${where.reason}`);
    beats = [
      ...new Set([
        where.beat,
        ...(n.anchor?.beats ?? []).filter((id) =>
          timeline.beats.some((b) => b.id === id),
        ),
      ]),
    ];
  }

  if (o.chapter) {
    const { timeline } = await workingTimeline(dir);
    beats = timeline.beats
      .filter((b) => b.chapter === o.chapter)
      .map((b) => b.id);
    if (!beats.length) throw new Error(`No chapter "${o.chapter}".`);
  }

  const handles = o.handles == null ? 2 : Number(o.handles);

  const r = await renderRange(dir, {
    ...span,
    beats,
    handles,
    rough: !!o.rough,
    out: o.out,
    verify: !o['no-verify'],
  });

  if (o.json) return json(r);

  return console.log(
    [
      `preview: ${rel(r.output)} · frames ${r.range.frames[0]}–${r.range.frames[1]} of the film (${formatTime(r.range.seconds[0])}–${formatTime(r.range.seconds[1])}, ${r.frames} frames, ${r.seconds.toFixed(1)} s to render)`,
      `beats: ${r.beats.map((b) => b.id).join(', ')}`,
      r.verified
        ? `clock: preview frames match the film at ${r.verified.map((v) => `${v.film} (${v.psnr != null && Number.isFinite(v.psnr) ? v.psnr.toFixed(1) : '∞'} dB)`).join(' and ')}`
        : 'clock: not checked (--no-verify)',
      r.audio
        ? `audio: samples ${r.audio.samples[0]}–${r.audio.samples[1]} of the full mix (film ${r.audio.film?.integrated} LUFS; this stretch ${r.audio.stretch?.integrated} LUFS)`
        : 'audio: none',
      r.notValidated.placeholders.length
        ? `placeholders: ${r.notValidated.placeholders.map((p) => p.beat).join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}
