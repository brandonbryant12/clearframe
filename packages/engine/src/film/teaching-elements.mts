import type { CanvasElement, HelperFrame, ElementFields } from './types.mjs';
import type { Teaching } from './teaching-common.mjs';
import { check, text, line } from './teaching-common.mjs';
export function teachingElements(
  p: Teaching,
  { width = 1920, height = 1080, duration }: Partial<HelperFrame> = {},
) {
  const tall = width <= height * 1.1,
    split = p.layout === 'split';
  check(
    !split || !tall,
    'split layout needs a landscape frame; use full or custom canvas in portrait',
  );
  if (duration != null && p.phase === 'answer')
    check(
      p.explainAt + 1 <= duration,
      'answer beat must leave at least one second after explainAt',
    );
  const u = Math.min(width, height),
    x = width * 0.12,
    w = width * (split ? 0.34 : 0.76),
    titleSize = u * (split ? 0.05 : 0.068),
    bodySize = u * (split ? 0.038 : 0.052),
    optionTop = height * (tall ? 0.39 : 0.43),
    optionStep = height * (tall ? 0.102 : 0.108),
    explainY = height * (tall ? 0.79 : 0.8),
    answer = p.phase === 'answer',
    appear = (at: number): ElementFields => ({
      at,
      enter: p.motion === 'none' ? 'none' : 'fade',
      dur: 0.25,
    });
  const elements = [
    text('teach-prompt', p.prompt, x, height * 0.19, titleSize, w),
  ];
  const context = {
    u,
    x,
    w,
    height,
    tall,
    bodySize,
    optionTop,
    optionStep,
    answer,
    appear,
    elements,
  };
  if (p.form === 'choice') choiceElements(p, context);
  else gapElements(p, context);
  if (answer)
    elements.push(
      text(
        'teach-explanation',
        p.explanation,
        x,
        explainY,
        u * (split ? 0.032 : 0.038),
        w,
        { font: 'text', fill: 'muted', ...appear(p.explainAt) },
      ),
    );
  else
    elements.push(
      text(
        'teach-reading',
        'Pause and consider.',
        x,
        height * 0.8,
        u * 0.036,
        w,
        { font: 'text', fill: 'muted' },
      ),
    );
  return elements;
}

interface TeachingScene {
  u: number;
  x: number;
  w: number;
  height: number;
  tall: boolean;
  bodySize: number;
  optionTop: number;
  optionStep: number;
  answer: boolean;
  appear: (at: number) => ElementFields;
  elements: CanvasElement[];
}
function choiceElements(
  p: Extract<Teaching, { form: 'choice' }>,
  {
    u,
    x,
    w,
    height,
    tall,
    bodySize,
    optionTop,
    optionStep,
    answer,
    appear,
    elements,
  }: TeachingScene,
): void {
  p.options.forEach((value, i) => {
    const y = optionTop + i * optionStep,
      letter = String.fromCharCode(65 + i);
    elements.push(
      text(`teach-letter-${i}`, letter, x, y, bodySize * 0.82, u * 0.045, {
        font: 'mono',
        fill: 'muted',
      }),
      text(
        `teach-option-${i}`,
        value,
        x + u * 0.065,
        y,
        bodySize,
        w - u * 0.065,
        { fill: 'ink' },
      ),
    );
    if (answer && i === p.correctIndex) {
      elements.push(
        line(
          'teach-answer-rule',
          x + u * 0.065,
          y + bodySize * 0.31,
          x + w,
          y + bodySize * 0.31,
          { stroke: 'accent', width: 4, ...appear(p.revealAt) },
        ),
      );
    }
  });
  if (answer)
    elements.push(
      text(
        'teach-answer-label',
        `Answer ${String.fromCharCode(65 + p.correctIndex)}`,
        x,
        height * (tall ? 0.735 : 0.755),
        u * 0.042,
        w,
        { font: 'strong', fill: 'accent', ...appear(p.revealAt) },
      ),
    );
}
function gapElements(
  p: Extract<Teaching, { form: 'gap' }>,
  { x, w, height, tall, bodySize, answer, appear, elements }: TeachingScene,
): void {
  const y = height * (tall ? 0.39 : 0.405),
    gapY = height * (tall ? 0.5 : 0.54),
    afterY = height * (tall ? 0.6 : 0.655);
  elements.push(
    text('teach-before', p.before, x, y, bodySize, w),
    line(
      'teach-gap-rule',
      x,
      gapY + bodySize * 0.35,
      x + w,
      gapY + bodySize * 0.35,
      { stroke: 'accent', width: 3 },
    ),
  );
  if (p.after)
    elements.push(text('teach-after', p.after, x, afterY, bodySize, w));
  if (answer)
    elements.push(
      text('teach-filled-answer', p.answer, x, gapY, bodySize * 1.18, w, {
        fill: 'accent',
        ...appear(p.revealAt),
      }),
    );
}
