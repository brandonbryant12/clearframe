import type { BuildOptions } from './common.mjs';
import { PARTS, ICON } from './common.mjs';

export function inspectValidate(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
) {
  const marks = params.marks ?? ['subject', 'sender', 'link'];

  const color = params.color ?? 'negative';

  validateMarks(marks);

  if (!(color in ICON))
    throw new Error(
      `sketchParams.color for inspect must be ${Object.keys(ICON).join(', ')}`,
    );

  validateOptions(params);

  const attach = params.attachment === true || marks.includes('attachment');

  const report = params.report === true;

  const choices = params.choices === true;

  // A beat that opens on the marked card (start) or stops at it (end) shares the card with a
  // beat that reports it.
  const standing = params.start === 'marked',
    stopping = params.end === 'marked';

  if (choices && !report)
    throw new Error(
      'sketchParams.choices for inspect needs report: true (CLICK and DELETE come before REPORT)',
    );

  if ((standing || stopping) && !report)
    throw new Error(
      `sketchParams.${standing ? 'start' : 'end'} "marked" for inspect needs report: true: it splits the marks and the report step (CLICK, DELETE with choices, REPORT) into two beats on one card`,
    );

  if (standing && stopping)
    throw new Error(
      'sketchParams for inspect: start "marked" with end "marked" leaves no moment; use one on each of two beats',
    );
  return { w, h, marks, color, attach, report, choices, standing, stopping };
}

function validateMarks(marks: string[]) {
  if (!Array.isArray(marks) || !marks.length || marks.length > 3)
    throw new Error('sketchParams.marks for inspect takes 1–3 parts');

  for (const m of marks)
    if (!PARTS.includes(m))
      throw new Error(
        `sketchParams.marks for inspect: "${m}" is not a part (use ${PARTS.join(', ')})`,
      );

  if (new Set(marks).size !== marks.length)
    throw new Error(
      'sketchParams.marks for inspect: each part can be marked once',
    );
}

function validateOptions(params: NonNullable<BuildOptions['params']>) {
  if (params.attachment != null && typeof params.attachment !== 'boolean')
    throw new Error(
      'sketchParams.attachment for inspect must be true or false',
    );

  if (params.report != null && typeof params.report !== 'boolean')
    throw new Error('sketchParams.report for inspect must be true or false');

  if (params.choices != null && typeof params.choices !== 'boolean')
    throw new Error('sketchParams.choices for inspect must be true or false');

  if (params.start != null && !['open', 'marked'].includes(params.start))
    throw new Error(
      'sketchParams.start for inspect must be "open" or "marked"',
    );

  if (params.end != null && !['last', 'marked'].includes(params.end))
    throw new Error('sketchParams.end for inspect must be "last" or "marked"');
}
