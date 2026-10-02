// Pause, answer and explain using editable native type; no interaction is simulated.
const finite = value => typeof value === 'number' && Number.isFinite(value);
const check = (ok, message) => { if (!ok) throw new Error(`teaching: ${message}`); };
const show = { at: 0, enter: 'none' };
const copy = (value, field, max, optional = false) => {
  if (value == null && optional) return '';
  check(typeof value === 'string' && value.trim() && value.length <= max, `${field} must be nonempty text up to ${max} characters`);
  return value;
};
const text = (id, value, x, y, size, width, extra = {}) => ({ type: 'text', id, text: value, x, y, size, width, leading: 1.15, font: 'display', fill: 'ink', ...show, ...extra });
const line = (id, x1, y1, x2, y2, extra = {}) => ({ type: 'line', id, x1, y1, x2, y2, stroke: 'muted', width: 2, ...show, ...extra });

export function teachingSpec(input, source) {
  check(input && typeof input === 'object' && !Array.isArray(input), 'must be an object');
  const allowed = ['form', 'phase', 'prompt', 'source', 'layout', 'motion', 'revealAt', 'explainAt', 'options', 'correctIndex', 'before', 'answer', 'after', 'explanation'];
  for (const key of Object.keys(input)) check(allowed.includes(key), `unknown field ${key}`);
  const p = structuredClone(input);
  check(['choice', 'gap'].includes(p.form), 'form must be choice or gap');
  check(['question', 'answer'].includes(p.phase), 'phase must be question or answer');
  p.prompt = copy(p.prompt, 'prompt', 100);
  p.explanation = copy(p.explanation, 'explanation', 130);
  p.layout ??= 'full'; check(['full', 'split'].includes(p.layout), 'layout must be full or split');
  p.motion ??= 'fade'; check(['fade', 'none'].includes(p.motion), 'motion must be fade or none');
  p.revealAt ??= 0.25; p.explainAt ??= 1.1;
  check(finite(p.revealAt) && p.revealAt >= 0 && p.revealAt <= 2, 'revealAt must be 0–2 seconds');
  check(finite(p.explainAt) && p.explainAt >= p.revealAt && p.explainAt <= 4, 'explainAt must follow revealAt and be at most 4 seconds');
  if (p.source != null && source != null) check(p.source === source, 'source conflicts with props.source');
  p.source = copy(p.source ?? source, 'source', 160);
  if (p.form === 'choice') {
    check(p.before == null && p.answer == null && p.after == null, 'choice uses options and correctIndex');
    check(Array.isArray(p.options) && p.options.length >= 2 && p.options.length <= 3, 'choice needs 2–3 options');
    p.options = p.options.map((value, i) => copy(value, `options[${i}]`, 46));
    check(new Set(p.options.map(s => s.trim().toLowerCase())).size === p.options.length, 'options must be distinct');
    check(Number.isInteger(p.correctIndex) && p.correctIndex >= 0 && p.correctIndex < p.options.length, 'correctIndex must select an option');
  } else {
    check(p.options == null && p.correctIndex == null, 'gap uses before, answer and after');
    p.before = copy(p.before, 'before', 70);
    p.answer = copy(p.answer, 'answer', 46);
    p.after = copy(p.after, 'after', 50, true);
  }
  return p;
}

export function teachingElements(p, { width = 1920, height = 1080, duration } = {}) {
  const tall = width <= height * 1.1, split = p.layout === 'split';
  check(!split || !tall, 'split layout needs a landscape frame; use full or custom canvas in portrait');
  if (duration != null && p.phase === 'answer') check(p.explainAt + 1 <= duration, 'answer beat must leave at least one second after explainAt');
  const u = Math.min(width, height), x = width * 0.12, w = width * (split ? 0.34 : 0.76),
    titleSize = u * (split ? 0.047 : 0.061), bodySize = u * (split ? 0.035 : 0.046),
    optionTop = height * (tall ? 0.39 : 0.43), optionStep = height * (tall ? 0.102 : 0.108),
    explainY = height * (tall ? 0.79 : 0.80), answer = p.phase === 'answer',
    appear = at => ({ at, enter: p.motion === 'none' ? 'none' : 'fade', dur: 0.25 });
  const elements = [text('teach-prompt', p.prompt, x, height * 0.19, titleSize, w)];
  if (p.form === 'choice') {
    p.options.forEach((value, i) => {
      const y = optionTop + i * optionStep, letter = String.fromCharCode(65 + i);
      elements.push(text(`teach-letter-${i}`, letter, x, y, bodySize * 0.82, u * 0.045, { font: 'mono', fill: 'muted' }),
        text(`teach-option-${i}`, value, x + u * 0.065, y, bodySize, w - u * 0.065, { fill: 'ink' }));
      if (answer && i === p.correctIndex) {
        elements.push(line('teach-answer-rule', x + u * 0.065, y + bodySize * 0.31, x + w, y + bodySize * 0.31, { stroke: 'accent', width: 4, ...appear(p.revealAt) }));
      }
    });
    if (answer) elements.push(text('teach-answer-label', `Answer ${String.fromCharCode(65 + p.correctIndex)}`, x, height * (tall ? 0.735 : 0.755), u * 0.032, w, { font: 'mono', fill: 'accent', ...appear(p.revealAt) }));
  } else {
    const y = height * (tall ? 0.39 : 0.405), gapY = height * (tall ? 0.50 : 0.54), afterY = height * (tall ? 0.60 : 0.655);
    elements.push(text('teach-before', p.before, x, y, bodySize, w),
      line('teach-gap-rule', x, gapY + bodySize * 0.35, x + w, gapY + bodySize * 0.35, { stroke: 'accent', width: 3 }));
    if (p.after) elements.push(text('teach-after', p.after, x, afterY, bodySize, w));
    if (answer) elements.push(text('teach-filled-answer', p.answer, x, gapY, bodySize * 1.18, w, { fill: 'accent', ...appear(p.revealAt) }));
  }
  if (answer) elements.push(text('teach-explanation', p.explanation, x, explainY, u * (split ? 0.028 : 0.032), w, { font: 'text', fill: 'muted', ...appear(p.explainAt) }));
  else elements.push(text('teach-reading', 'Pause and consider.', x, height * 0.80, u * 0.028, w, { font: 'mono', fill: 'muted' }));
  return elements;
}

export function expandTeachingProps(input, frame) {
  if (input?.teaching == null) return input;
  const { teaching, ...rest } = structuredClone(input);
  check(rest.kpi == null && rest.chart == null && rest.sketch == null && rest.plates == null, 'cannot combine teaching with kpi, chart, sketch or plates shorthand');
  const p = teachingSpec(teaching, rest.source), drawn = teachingElements(p, frame);
  if (frame.beatId) for (const el of drawn) if (el.id) el.id = `${frame.beatId}-${el.id}`;
  return { ...rest, source: p.source, view: [0, 0, frame.width, frame.height], elements: [...drawn, ...(rest.elements ?? [])] };
}
