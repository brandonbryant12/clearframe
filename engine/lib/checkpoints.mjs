// Where a human matters most in making a film, and where a project stands at each point.
// One-shot: the agent decides every checkpoint itself and logs its decisions in DIRECTION.md.
// Guided: it stops at the ones marked `ask` for a short yes, a choice or an edit.
// Everything else (timing, cues, layout, sound placement, check and critique fixes) is the
// agent's job in both modes. See docs/collaboration.md.
import fs from 'node:fs';
import path from 'node:path';
import { loadStoryboard } from './project.mjs';
import { plan } from './generate.mjs';
import { computeTiming } from './timing.mjs';

const mtime = f => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);
const answered = (text, prompt) => {
  const line = text.split('\n').find(l => l.includes(prompt));
  return (
    !!line &&
    line
      .slice(line.indexOf(prompt) + prompt.length)
      .replace(/^[:\s?]+/, '')
      .trim().length > 3
  );
};

/** The seven checkpoints for a project: {id, name, ask, done, detail, question}. */
export function checkpoints(root) {
  const sb = loadStoryboard(root);
  const direction = fs.existsSync(path.join(root, 'DIRECTION.md'))
    ? fs.readFileSync(path.join(root, 'DIRECTION.md'), 'utf8')
    : '';
  const story = fs.readFileSync(path.join(root, 'storyboard.json'), 'utf8');
  const sample = /illustrative|sample data|fictional|replace before publishing/i;
  const samples =
    (sb.sources ?? []).filter(s => sample.test(`${s.title ?? ''} ${s.id ?? ''}`)).length + (sample.test(story) ? 1 : 0);
  const narrated = sb.beats.filter(b => b.vo).length;
  const costs = plan(root);
  const pending = costs.rows.filter(r => r.status === 'todo' && r.cost > 0);
  const owed = pending.reduce((a, r) => a + r.cost, 0);
  const sheet = mtime(path.join(root, 'build', 'sheet.png')) || mtime(path.join(root, 'sheet.png'));
  const video = mtime(path.join(root, 'build', 'video.mp4'));
  const edited = mtime(path.join(root, 'storyboard.json'));
  const timing = computeTiming(root);
  return [
    {
      id: 'intent',
      name: 'Intent',
      ask: true,
      done:
        answered(direction, 'Who is watching, and what do they already believe?') &&
        answered(direction, 'The one thing they should understand or do afterwards:'),
      detail: 'audience and takeaway in DIRECTION.md',
      question: 'Who is this for, and what should they understand or do afterwards?',
    },
    {
      id: 'truth',
      name: 'Truth',
      ask: true,
      done: samples === 0,
      detail: samples ? `${samples} sample source(s) or placeholder claims remain` : 'every claim has a real source',
      question: 'Are these the right claims, and are the figures and sources correct?',
    },
    {
      id: 'story',
      name: 'Story and look',
      ask: true,
      done:
        answered(direction, 'The question the film answers:') &&
        !!(sb.treatment || sb.lens || typeof sb.theme === 'object'),
      detail: `${sb.treatment ? `treatment ${sb.treatment}` : 'no treatment'}; spine ${answered(direction, 'The question the film answers:') ? 'written' : 'not written'}`,
      question: 'Does the story spine (question, turn, payoff) and the look fit what you want?',
    },
    {
      id: 'script',
      name: 'Narration',
      ask: true,
      done: narrated > 0 && pending.filter(r => r.kind === 'voice').length === 0,
      detail: `${narrated} narrated beat(s); ${pending.some(r => r.kind === 'voice') ? 'not yet voiced' : 'voiced'}`,
      question: 'Read the narration aloud: are these the words, before the voice is recorded?',
    },
    {
      id: 'spend',
      name: 'Spend',
      ask: true,
      done: owed === 0,
      detail: owed
        ? `≈ $${owed.toFixed(2)} of paid generation pending${sb.budget != null ? ` (budget $${sb.budget})` : ''}`
        : 'nothing paid pending',
      question: `Approve about $${owed.toFixed(2)} for ${[...new Set(pending.map(r => r.kind))].join(', ') || 'generation'}?`,
    },
    {
      id: 'picture',
      name: 'Picture',
      ask: true,
      done: sheet > edited,
      detail: sheet ? (sheet > edited ? 'sheet is current' : 'storyboard changed since the sheet') : 'no sheet yet',
      question: 'Look at the contact sheet: is this the film you imagined?',
    },
    {
      id: 'final',
      name: 'Final',
      ask: true,
      done: video > edited && !timing.estimated,
      detail: video
        ? timing.estimated
          ? 'rendered with an estimated voice'
          : video > edited
            ? 'final is current'
            : 'storyboard changed since the render'
        : 'not rendered',
      question: 'Watch the final: ship it?',
    },
  ];
}
