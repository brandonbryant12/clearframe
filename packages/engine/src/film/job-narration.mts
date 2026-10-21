import type { TimedBeat as TimingBeat } from '../engine/domain.mjs';
import type { JobReport } from './types.mjs';

import { glyphCheck } from './glyphs.mjs';

export function checkNarration(
  b: TimingBeat,
  frame: number,
  captions: boolean,
  report: JobReport,
  face: string | null = null,
) {
  const soft = report.draft ? report.warnings : report.errors;
  if (b.vo?.estimated)
    soft.push(
      `${b.id}: narration is estimated; record/import audio or use --draft.`,
    );
  if (b.vo && (b.vo.start < b.start - 1e-3 || b.vo.end > b.end + frame))
    throw new Error(
      'Narration crosses beat bounds; remove the forced duration/negative lead.',
    );
  if (b.block === 'kinetic' && !b.vo?.words?.length)
    throw new Error('kinetic needs narration and word timestamps.');
  checkShownNarration(b, captions, face, soft);
}

function checkShownNarration(
  b: TimingBeat,
  captions: boolean,
  face: string | null,
  soft: string[],
): void {
  if ((b.block === 'kinetic' || captions) && b.vo) {
    glyphCheck(
      b.vo.text,
      `${b.id}.vo (shown as ${b.block === 'kinetic' ? 'kinetic text' : 'captions'})`,
      (m) => {
        throw new Error(m);
      },
    );
    if (face)
      glyphCheck(
        b.vo.text,
        `${b.id}.vo (shown as kinetic text)`,
        (m) => {
          throw new Error(m);
        },
        face,
      );
    if (b.vo.wordTiming !== 'measured')
      soft.push(
        `${b.id}: speech-following text requires measured word timestamps; run align or import timed speech.${b.vo.alignmentIssue ? ' ' + b.vo.alignmentIssue : ''}`,
      );
  }
}
