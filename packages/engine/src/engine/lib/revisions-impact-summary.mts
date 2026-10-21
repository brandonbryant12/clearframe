import type { ChangeStatus } from './revisions-model.mjs';
import { type SummaryInput, fmtShift } from './revisions-impact-common.mjs';

export function changeSummary(s: SummaryInput): string[] {
  const { counts, order } = s;
  const summary: string[] = [];
  const list = (status: ChangeStatus): string => {
    const ids = s.all.filter((x) => x.status === status).map((x) => x.id);
    return ids.length > 6
      ? `${ids.slice(0, 6).join(', ')} and ${ids.length - 6} more`
      : ids.join(', ');
  };
  if (s.global.length)
    summary.push(
      `Film-wide: ${s.global.map((k) => (k === 'look' ? 'the look (palette, motion, captions or framing)' : 'the renderer or fonts')).join(' and ')} changed, so any frame may differ.`,
    );
  if (s.film.sound === 'changed')
    summary.push(
      'The music or mix settings changed: listen to the whole film again.',
    );
  if (s.film.data === 'changed')
    summary.push('Sources or asset declarations changed.');
  if (order.reordered)
    summary.push(
      `The order of beats changed: ${order.moved.slice(0, 6).join(', ')}${order.moved.length > 6 ? ` and ${order.moved.length - 6} more` : ''} moved to another place.`,
    );
  if (counts.content)
    summary.push(
      `${counts.content} beat(s) changed in content: ${list('content')}.`,
    );
  if (counts.added)
    summary.push(`${counts.added} beat(s) added: ${list('added')}.`);
  if (counts.removed)
    summary.push(`${counts.removed} beat(s) removed: ${list('removed')}.`);
  if (counts.appearance)
    summary.push(
      `${counts.appearance} beat(s) look different without being edited: ${list('appearance')} (see reasons).`,
    );
  summary.push(...timeSummary(s));
  for (const t of s.takes)
    summary.push(
      `Narration changed in ${t.because.join(', ')}: its take ${t.take} (${t.beats.length} beats) must be re-recorded; every beat in it gets new audio and may move.`,
    );
  if (!summary.length)
    summary.push(
      'No differences: the same content renders on the same frames.',
    );
  summary.push(`${counts.unchanged ?? 0} beat(s) unchanged.`);
  return summary;
}

export function timeSummary({
  durationDelta,
  firstShift,
  B,
  counts,
}: SummaryInput): string[] {
  if (durationDelta) {
    const from = firstShift?.shift
      ? `; from ${firstShift.id} on, beats move ${fmtShift(firstShift.shift)}`
      : '';
    const music = B.music
      ? ', and the music bed (timed to the film clock) now sits differently under every later picture'
      : '';
    return [
      `The film is ${Math.abs(durationDelta).toFixed(2)} s ${durationDelta < 0 ? 'shorter' : 'longer'}${from}${music}.`,
    ];
  }
  return counts.shifted
    ? [`${counts.shifted} beat(s) moved in time without other changes.`]
    : [];
}
