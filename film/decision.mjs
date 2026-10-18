// A stated rule as a path: yes/no questions lead to outcomes. A case walks its path — each
// question lights with the case's answer and the outcome it reaches is marked — and a
// counterfactual changes one answer: the first path stays on screen as a ghost, the new one
// diverges where the answer changed and lands on its own outcome beside the first, so the two
// can be compared; `return` brings the factual case back. The rule is the author's (an example
// unless a source says otherwise); the picture computes only which branch each case takes.
import { plotLayout, titleText, titleShift } from './plots.mjs';

const check = (ok, message) => { if (!ok) throw new Error(`decision: ${message}`); };
const ID = /^[a-z][a-z0-9-]{0,23}$/;
const show = { at: 0, enter: 'none' };
const own = (o, keys, name) => {
  check(o && typeof o === 'object' && !Array.isArray(o), `${name} must be an object`);
  for (const k of Object.keys(o)) check(keys.includes(k), `unknown ${name}.${k} (it takes ${keys.join(', ')})`);
};
const words = (v, name, max) => { check(typeof v === 'string' && v.trim() && v.length <= max, `${name} needs text up to ${max} characters`); return v; };
const timing = (v, name) => {
  check(['say', 'cue', 'at'].filter(k => v[k] != null).length <= 1, `${name} takes one of say, cue or at`);
  check(v.after == null || v.say != null || v.cue != null, `${name}.after needs say or cue`);
};
const TONES = ['positive', 'negative', 'accent', 'muted'];
export const HOP = 0.55;

/** Validate a rule tree, its outcomes and the cases that walk it. */
export function decisionSpec(input) {
  own(input, ['id', 'title', 'source', 'asOf', 'ask', 'tree', 'outcomes', 'cases', 'return'], 'decision');
  const p = { id: 'decision', ...structuredClone(input) };
  check(typeof p.id === 'string' && ID.test(p.id), 'id is a short lowercase name');
  words(p.title, 'title', 70);
  p.source = words(p.source ?? 'Example rule for illustration', 'source', 110);
  check(Array.isArray(p.ask) && p.ask.length >= 1 && p.ask.length <= 4, 'ask needs 1–4 questions: {id, label, yes?, no?}');
  const asks = new Map();
  p.ask.forEach((q, i) => {
    own(q, ['id', 'label', 'yes', 'no'], `ask[${i}]`);
    check(typeof q.id === 'string' && ID.test(q.id) && !asks.has(q.id), `ask[${i}].id is a unique short lowercase name`);
    words(q.label, `ask[${i}].label`, 40);
    q.yes = words(q.yes ?? 'Yes', `ask[${i}].yes`, 14);
    q.no = words(q.no ?? 'No', `ask[${i}].no`, 14);
    asks.set(q.id, q);
  });
  check(Array.isArray(p.outcomes) && p.outcomes.length >= 2 && p.outcomes.length <= 5, 'outcomes needs 2–5: {id, label, tone?}');
  const outcomes = new Map();
  p.outcomes.forEach((o, i) => {
    own(o, ['id', 'label', 'tone'], `outcomes[${i}]`);
    check(typeof o.id === 'string' && ID.test(o.id) && !outcomes.has(o.id) && !asks.has(o.id), `outcomes[${i}].id is a unique short lowercase name (not a question's)`);
    words(o.label, `outcomes[${i}].label`, 40);
    check(o.tone == null || TONES.includes(o.tone), `outcomes[${i}].tone is ${TONES.join(', ')}`);
    outcomes.set(o.id, o);
  });
  // The tree: {ask: ID, yes: subtree | outcome id, no: subtree | outcome id}; every question at most
  // once on any path, every outcome and every question reachable.
  const reached = new Set(), used = new Set();
  const walk = (node, path, where) => {
    if (typeof node === 'string') {
      check(outcomes.has(node), `${where} names "${node}", which is neither an outcome nor a question node`);
      reached.add(node);
      return { outcome: node };
    }
    own(node, ['ask', 'yes', 'no'], where);
    check(asks.has(node.ask), `${where}.ask names a question (${[...asks.keys()].join(', ')})`);
    check(!path.includes(node.ask), `${where} asks ${node.ask} again on the same path`);
    used.add(node.ask);
    check(node.yes != null && node.no != null, `${where} needs both yes and no`);
    return { ask: node.ask, yes: walk(node.yes, [...path, node.ask], `${where}.yes`), no: walk(node.no, [...path, node.ask], `${where}.no`) };
  };
  p.root = walk(p.tree, [], 'tree');
  for (const o of outcomes.keys()) check(reached.has(o), `outcome ${o} is never reached by the tree`);
  for (const q of asks.keys()) check(used.has(q), `question ${q} is never asked by the tree`);
  check(Array.isArray(p.cases) && p.cases.length >= 1 && p.cases.length <= 2, 'cases needs 1–2: the case, then optionally the same case with one answer changed (counterfactual)');
  p.cases.forEach((c, i) => {
    own(c, ['label', 'answers', 'say', 'cue', 'at', 'after'], `cases[${i}]`);
    words(c.label, `cases[${i}].label`, 48);
    own(c.answers, [...asks.keys()], `cases[${i}].answers`);
    for (const [k, v] of Object.entries(c.answers)) check(v === 'yes' || v === 'no', `cases[${i}].answers.${k} is "yes" or "no"`);
    timing(c, `cases[${i}]`);
    c.path = route(p.root, c.answers, `cases[${i}]`);
  });
  if (p.cases.length === 2) {
    const [a, b] = p.cases;
    const changed = [...asks.keys()].filter(k => (a.answers[k] ?? null) !== (b.answers[k] ?? null));
    check(changed.length >= 1, 'the counterfactual must change at least one answer');
    check(a.path.at(-1).outcome !== b.path.at(-1).outcome || a.path.length !== b.path.length || a.path.some((s, k) => s.answer !== b.path[k]?.answer),
      'the counterfactual takes the same path to the same outcome; change an answer the rule actually asks');
    b.changed = changed;
  }
  if (p.return != null) {
    own(p.return, ['say', 'cue', 'at', 'after'], 'return');
    timing(p.return, 'return');
    check(p.cases.length === 2, 'return brings the first case back after a counterfactual: it needs two cases');
  }
  return p;
}

/** The steps a case takes: each question with its answer, then the outcome. */
function route(root, answers, where) {
  const steps = [];
  let node = root;
  while (node.ask) {
    const answer = answers[node.ask];
    check(answer != null, `${where}.answers needs ${node.ask}: the rule asks it on this case's path`);
    steps.push({ ask: node.ask, answer });
    node = node[answer];
  }
  steps.push({ outcome: node.outcome });
  return steps;
}

/** Positions: questions in columns by depth, outcomes in a final column, rows by first reach. */
function layout(p, frame) {
  const { width: W, height: H } = frame, L = { ...plotLayout(frame) };
  const wide = W >= H;
  if (!wide) L.margin = Math.max(L.margin, Math.round(W * 0.115) + 4);
  const shift = titleShift(p.title, L, W - 2 * L.margin);
  const nodes = [], order = [];
  const depthOf = (node, d) => (node.ask ? Math.max(depthOf(node.yes, d + 1), depthOf(node.no, d + 1)) : d);
  const depth = depthOf(p.root, 0);
  const visit = (node, d, key) => {
    if (!node.ask) {
      if (!order.includes(node.outcome)) order.push(node.outcome);
      return { outcome: node.outcome };
    }
    const kids = { yes: visit(node.yes, d + 1, `${key}-y`), no: visit(node.no, d + 1, `${key}-n`) };
    const entry = { key, ask: node.ask, d, kids };
    nodes.push(entry);
    return entry;
  };
  const tree = visit(p.root, 0, 'q');
  // Read on a phone: card type is 40 px in a wide frame (36 in a tall one), each card holds two
  // lines, and the case and its outcome sit above the rule in large type. A rule too broad or too
  // deep to keep that size is refused rather than shrunk.
  const font = wide ? 40 : 36, caseSize = wide ? 40 : 38;
  const left = L.margin, right = W - L.margin;
  const caseTop = L.keyY + shift;
  const top = caseTop + caseSize * 1.18 * 3 + (wide ? 30 : 50), bottom = L.bottom + (wide ? H * 0.03 : 0);
  // Wide: depth runs left to right. Tall: depth runs down the frame and outcomes sit along the foot.
  const cols = depth + 1, rows = order.length;
  check(depth <= 3, `the rule is ${depth} questions deep; at most 3 stay readable in one picture, so split it into two beats`);
  check(rows <= 3, `the rule has ${rows} outcomes; at most 3 stay readable side by side on a phone, so split the rule into two beats`);
  const across = wide ? (right - left) / cols : (bottom - top) / cols;
  const along = wide ? (bottom - top) / rows : (right - left) / rows;
  const card = wide ? { w: Math.min(across * 0.76, 480), h: 120 } : { w: Math.min(along * 0.92, 460), h: 120 };
  check(wide ? along >= card.h * 1.12 : across >= card.h * 1.6, 'the rule does not fit this frame at a readable size; split it into two beats');
  const room = card.w - 36, perLine = Math.floor(room / (font * 0.56));
  for (const label of [...p.ask.map(q => q.label), ...p.outcomes.map(o => o.label)])
    check(lines(label, room, font) <= 2, `"${label}" needs more than two lines in a card this size; keep it to about ${perLine * 2 - 4} characters`);
  const outPos = new Map(order.map((o, i) => [o, wide ? { x: left + across * (cols - 0.5), y: top + along * (i + 0.5) } : { x: left + along * (i + 0.5), y: top + across * (cols - 0.5) }]));
  const place = entry => {
    if (entry.outcome) return outPos.get(entry.outcome);
    const a = place(entry.kids.yes), b = place(entry.kids.no);
    entry.pos = wide ? { x: left + across * (entry.d + 0.5), y: (a.y + b.y) / 2 } : { x: (a.x + b.x) / 2, y: top + across * (entry.d + 0.5) };
    return entry.pos;
  };
  place(tree);
  return { L, W, H, wide, shift, nodes, order, outPos, card, font, caseSize, caseTop, top, left, right };
}

const fill = tone => ({ positive: 'positive', negative: 'negative', accent: 'accent', muted: 'muted' })[tone] ?? 'ink';
// Lines a label needs at a size in a width (an estimate, about half an em per character; the
// native frame audit is what proves the result fits).
function lines(text, room, size) {
  let n = 1, line = 0;
  for (const w of String(text).split(/\s+/)) {
    const ww = w.length * size * 0.56, gap = size * 0.28;
    if (line && line + gap + ww > room) { n++; line = ww; } else line += (line ? gap : 0) + ww;
  }
  return n;
}
// A label inside a card: one line when it fits, otherwise two wrapped lines, never shrunk.
function cardLabel(text, cx, cy, w, size, font) {
  const room = w - 36;
  if (lines(text, room, size) <= 1) return { type: 'text', text, x: cx, y: cy + size * 0.35, size, anchor: 'middle', font, fill: 'ink', fit: room };
  return { type: 'text', text, x: cx, y: cy - size * 0.2, size, anchor: 'middle', font, fill: 'ink', width: room, leading: 1.08 };
}

/** Canvas elements for one beat; `when(item, fallback)` resolves say/cue/at. */
export function decisionElements(p, frame, when = (item, fallback) => item?.at ?? fallback) {
  const G = layout(p, frame), { card, font, wide } = G;
  const id = (...k) => `dc-${p.id}-${k.join('-')}`;
  // The rule's cards and connectors are the same objects in every beat (they may morph across a
  // cut); the timed case lines and walks belong to this beat, so their ids carry the beat's.
  const timed = (...k) => (frame.beatId ? `${frame.beatId}-${id(...k)}` : id(...k));
  const title = titleText(p.title, G.L, G.W - 2 * G.L.margin);
  title.id = id('title');
  const out = [title];
  const byAsk = new Map(G.nodes.map(n => [n.key, n]));
  const askLabel = k => p.ask.find(q => q.id === k);
  // Connector geometry from a question to a child (question or outcome): an elbow, out of the
  // card's far side, along the gap, into the child's near side.
  const childPos = kid => (kid.outcome ? G.outPos.get(kid.outcome) : kid.pos);
  const edge = (n, branch) => {
    const a = n.pos, b = childPos(n.kids[branch]);
    if (wide) {
      // The branch bends near its child, so the Yes/No labels sit on the clear stretch by the question.
      const x1 = a.x + card.w / 2, x2 = b.x - card.w / 2, xm = Math.max((x1 + x2) / 2, x2 - 34);
      return { d: `M ${x1} ${a.y} H ${xm} V ${b.y} H ${x2}`, label: { x: x1 + 14, y: a.y + (b.y < a.y ? -14 : b.y > a.y ? 34 : -14) } };
    }
    const y1 = a.y + card.h / 2, y2 = b.y - card.h / 2, ym = (y1 + y2) / 2;
    return { d: `M ${a.x} ${y1} V ${ym} H ${b.x} V ${y2}`, label: { x: a.x + (b.x < a.x ? -16 : 16), y: y1 + 34, anchor: b.x < a.x ? 'end' : 'start' } };
  };
  // The rule: every question, connector, answer and outcome is there from the start, quietly.
  for (const n of G.nodes) {
    const q = askLabel(n.ask);
    out.push({ id: id('node', n.key), type: 'rect', x: n.pos.x - card.w / 2, y: n.pos.y - card.h / 2, w: card.w, h: card.h, r: 14, fill: 'surface', stroke: 'line', width: 2, ...show },
      { id: id('node', n.key, 'label'), ...cardLabel(q.label, n.pos.x, n.pos.y, card.w, font, 'semibold'), ...show });
    for (const branch of ['yes', 'no']) {
      const e = edge(n, branch);
      out.push({ id: id('edge', n.key, branch), type: 'path', d: e.d, fill: 'none', stroke: 'line', width: 3, ...show },
        { id: id('edge', n.key, branch, 'label'), type: 'text', text: q[branch], x: e.label.x, y: e.label.y, size: font * 0.75, anchor: e.label.anchor ?? 'start', font: 'semibold', fill: 'muted', ...show });
    }
  }
  for (const [o, pos] of G.outPos) {
    const oc = p.outcomes.find(x => x.id === o);
    out.push({ id: id('out', o), type: 'rect', x: pos.x - card.w / 2, y: pos.y - card.h / 2, w: card.w, h: card.h, r: card.h / 2, fill: 'wash', stroke: fill(oc.tone), width: 2, ...show },
      { id: id('out', o, 'label'), ...cardLabel(oc.label, pos.x, pos.y, card.w, font, 'strong'), ...show });
  }
  // The cases walk the rule.
  const starts = [];
  let clock = 0;
  p.cases.forEach((c, ci) => {
    const t0 = when(c, ci === 0 ? 0.8 : clock + 0.8);
    check(t0 >= clock - 1e-6, `cases[${ci}] starts at ${t0.toFixed(2)} s, before the case before it has finished (${clock.toFixed(2)} s)`);
    starts.push(t0);
    clock = t0 + (c.path.length - 1) * HOP + 0.6;
  });
  const back = p.return ? when(p.return, clock + 0.6) : null;
  if (back != null) check(back >= clock - 1e-6, `return lands at ${back.toFixed(2)} s, before the counterfactual has finished (${clock.toFixed(2)} s)`);
  // The case line: what this case is, every answer it gives; a changed answer is marked.
  const caseText = c => `${c.label}: ${p.ask.filter(q => c.answers[q.id] != null).map(q => `${q.label} ${q[c.answers[q.id]]}`).join(' · ')}`;
  const caseY = G.caseTop, width = G.W - 2 * G.L.margin;
  for (const c of p.cases)
    check(lines(caseText(c), width, G.caseSize) <= 2, `the case line "${caseText(c)}" needs more than two lines; shorten the case label or the questions`);
  p.cases.forEach((c, ci) => {
    const t0 = starts[ci], next = ci + 1 < p.cases.length ? starts[ci + 1] : null;
    const text = caseText(c);
    // Only answers this case's line actually shows can be marked as changed (a counterfactual that
    // ends sooner no longer answers a later question, so that answer is not on its line at all).
    const changed = (c.changed ?? []).filter(k => c.answers[k] != null).map(k => `${askLabel(k).label} ${askLabel(k)[c.answers[k]]}`);
    // Each case's line is on screen while it is the case being shown (the first returns with it);
    // the next line's fade-in starts as this one leaves, so two lines never share the frame.
    const lead = 0.3;
    const spans = ci === 0 ? [[t0 - lead, next != null ? next - lead : null], ...(back != null ? [[back, null]] : [])] : [[t0 - lead, back]];
    // The outcome it reaches, under the case line in its tone, once the walk arrives (never before).
    const outcome = p.outcomes.find(o => o.id === c.path.at(-1).outcome), arrive = t0 + (c.path.length - 1) * HOP;
    const outY = caseY + G.caseSize * 1.18 * lines(text, width, G.caseSize) + 6;
    spans.forEach(([a, b], si) =>
      out.push({ id: timed('case', ci, si), type: 'text', text, x: G.L.margin, y: caseY, size: G.caseSize, font: 'semibold', fill: 'ink', width, leading: 1.18,
        at: Math.max(0, a), enter: 'fade', dur: 0.3, ...(b != null ? { exit: 'none', exitAt: b } : {}),
        ...(changed.length && si === 0 ? { marks: changed.map(w => ({ words: w, style: 'highlight', at: t0 })) } : {}) },
        { id: timed('case', ci, si, 'outcome'), type: 'text', text: `→ ${outcome.label}`, x: G.L.margin, y: outY, size: G.caseSize, font: 'strong', fill: outcome.tone ? fill(outcome.tone) : 'ink',
          at: si === 0 ? arrive : Math.max(0, a), enter: si === 0 ? 'rise' : 'fade', dur: 0.3, ...(b != null ? { exit: 'none', exitAt: b } : {}) }));
  });
  // A walk: the path draws over the chosen connectors, hop by hop, and lights the cards it passes.
  const walkPath = c => {
    let node = byAsk.get('q');
    const segs = [];
    for (const step of c.path.slice(0, -1)) {
      const e = edge(node, step.answer);
      segs.push({ node, step, d: e.d });
      node = node.kids[step.answer];
    }
    return segs;
  };
  const factual = walkPath(p.cases[0]);
  p.cases.forEach((c, ci) => {
    const t0 = starts[ci], segs = walkPath(c), outcome = c.path.at(-1).outcome;
    const ghostAt = ci === 0 && p.cases.length === 2 ? starts[1] : ci === 1 && back != null ? back : null;
    const restoreAt = ci === 0 && back != null ? back : null;
    // When the first case returns, the counterfactual's hops it shares with it step aside entirely
    // (they would sit over the restored path); where it diverged it stays as a ghost to compare.
    const dim = (shared = false) => (ghostAt != null ? { keys: [{ at: ghostAt, dur: 0.4, opacity: ci === 1 && shared ? 0 : 0.3 }, ...(restoreAt != null ? [{ at: restoreAt, dur: 0.4, opacity: 1 }] : [])] } : {});
    segs.forEach(({ node, step, d }, k) => {
      const at = t0 + k * HOP;
      const shared = ci === 1 && factual[k]?.d === d;
      out.push({ id: timed('walk', ci, k), type: 'path', d, fill: 'none', stroke: ci ? 'accent2' : 'accent', width: 7, cap: 'round', join: 'round', ...(ci ? { dash: [18, 10] } : {}),
        at, enter: 'draw', dur: HOP * 0.9, ...dim(shared) },
        { id: timed('walk', ci, k, 'card'), type: 'rect', x: node.pos.x - card.w / 2 - 5, y: node.pos.y - card.h / 2 - 5, w: card.w + 10, h: card.h + 10, r: 18,
          fill: 'none', stroke: ci ? 'accent2' : 'accent', width: 4, at, enter: 'fade', dur: 0.25, ...dim(shared || (ci === 1 && factual.some(f => f.node === node))) });
    });
    const pos = G.outPos.get(outcome), arrive = t0 + segs.length * HOP;
    out.push({ id: timed('walk', ci, 'out'), type: 'rect', x: pos.x - card.w / 2 - 6, y: pos.y - card.h / 2 - 6, w: card.w + 12, h: card.h + 12, r: card.h / 2 + 6,
      fill: 'none', stroke: ci ? 'accent2' : 'accent', width: 5, at: arrive, enter: 'draw', dur: 0.5, ...dim() });
  });
  return { elements: out, end: back != null ? back + 0.6 : clock };
}

export function expandDecisionProps(input, frame) {
  if (input?.decision == null) return input;
  const { decision, ...rest } = structuredClone(input);
  for (const key of ['plot', 'bars', 'bridge', 'breakdown', 'process', 'stat', 'distribution', 'multiples', 'kpi', 'teaching', 'chart', 'sketch', 'plates', 'world', 'title', 'diagram'])
    check(rest[key] == null, `cannot combine decision with ${key}`);
  const p = decisionSpec(decision);
  check(rest.source == null || rest.source === p.source, 'the decision names its rule source in decision.source');
  const when = frame.when ? (item, fallback) => (item && (item.say != null || item.cue != null || item.at != null) ? frame.when(item, fallback, 'decision') : fallback) : (item, fallback) => item?.at ?? fallback;
  const { elements, end } = decisionElements(p, frame, when);
  if (frame.duration != null) check(end <= frame.duration, `the cases finish at ${end.toFixed(2)} s, after the beat ends at ${frame.duration.toFixed(2)} s; cue them earlier or lengthen the beat`);
  return { ...rest, source: `${p.source}${p.asOf ? ` · ${p.asOf}` : ''}`, view: rest.view ?? [0, 0, frame.width, frame.height], elements: [...elements, ...(rest.elements ?? [])] };
}
