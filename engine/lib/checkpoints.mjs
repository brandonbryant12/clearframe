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
import { listRevisions, loadRevision } from './revisions.mjs';
import { readDecisions, readNotes, acceptance } from './notes.mjs';

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

const anyAnswered = (text, prompts) => prompts.some(p => answered(text, p));
/** The `## Decisions` log in DIRECTION.md: one-shot films record each checkpoint there. */
function decisions(direction) {
  const at = direction.search(/^##\s*Decisions\b/im);
  if (at < 0) return () => false;
  const rest = direction.slice(at).split('\n').slice(1);
  const end = rest.findIndex(l => /^##\s/.test(l));
  const log = (end < 0 ? rest : rest.slice(0, end)).join('\n');
  // "- Intent: …", "**Look:** …", "Spend — draft only, no budget"
  return (...names) =>
    names.some(n => new RegExp(`^\\s*(?:[-*]\\s*)?(?:\\*\\*)?${n}\\b[^\\n]{0,40}?[:—–-]\\s*\\S`, 'im').test(log));
}

/**
 * Review milestones (rough cut, final) close on a recorded decision, not on a file's age: a
 * person's acceptance in guided work, or a labelled agent decision in one-shot work. A note
 * the person gave on a rough cut also closes the rough-cut look: they have steered it.
 */
function milestone(root, { profiles, checkpoint, mode }) {
  const revs = listRevisions(root);
  const watched = revs.filter(r => (r.videos ?? []).some(v => profiles.includes(v.profile)));
  const latest = watched.at(-1) ?? null;
  const decisions = readDecisions(root).filter(d => watched.some(r => r.id === d.revision));
  const human = [...decisions].reverse().find(d => d.role === 'human' && d.action === 'accept' && (!d.scope?.checkpoint || d.scope.checkpoint === checkpoint));
  const agent = [...decisions].reverse().find(d => d.role === 'agent' && d.action === 'decide' && d.scope?.checkpoint === checkpoint);
  const notes = readNotes(root).filter(n => n.author?.role === 'human' && watched.some(r => r.id === n.revision));
  return { latest, human, agent, notes, closed: !!human || (checkpoint === 'rough' && notes.length > 0) || (mode === 'one-shot' && !!agent) };
}

/**
 * Progress by chapter, for showing a long film a chapter at a time while tracking the whole:
 * beats, declared placeholders, elements marked unfinished, beats with a picture beyond their
 * captions, and beats a person accepted (still accepted in the newest revision).
 */
export function coverage(root) {
  const sb = loadStoryboard(root);
  const latest = listRevisions(root).at(-1);
  const accepted = latest ? acceptance(root, loadRevision(root, latest.id).timeline) : {};
  const unfinished = b =>
    JSON.stringify([b.props?.elements ?? [], b.art ?? {}]).match(/"unfinished":/g)?.length ?? 0;
  const out = [];
  for (const b of sb.beats) {
    const name = b.chapter ?? 'Whole film';
    let c = out.find(x => x.chapter === name);
    if (!c) out.push((c = { chapter: name, beats: 0, placeholders: 0, unfinished: 0, pictured: 0, accepted: 0 }));
    c.beats++;
    if (b.placeholder != null) c.placeholders++;
    c.unfinished += unfinished(b);
    if (b.placeholder == null && b.block && b.block !== 'kinetic') c.pictured++;
    if (['accepted', 'moved'].includes(accepted[b.id]?.state)) c.accepted++;
  }
  return out;
}

/** The checkpoints for a project: {id, name, ask, done, detail, question, decision?}. */
export function checkpoints(root, { mode = 'guided' } = {}) {
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
  const decided = decisions(direction);
  const spine = anyAnswered(direction, ['The question the film answers:', 'Question:', 'Spine:']);
  const drafted = costs.rows.filter(r => r.kind === 'voice').every(r => r.status !== 'todo');
  const rough = milestone(root, { profiles: ['rough', 'draft'], checkpoint: 'rough', mode });
  const final = milestone(root, { profiles: ['final'], checkpoint: 'final', mode });
  const said = d => (d.role === 'human' ? `accepted by ${d.by} (${d.id}, ${d.revision})` : `decided by the agent (${d.id}, ${d.revision}), not a person's acceptance`);
  return [
    {
      id: 'intent',
      name: 'Intent',
      ask: true,
      done:
        (anyAnswered(direction, ['Who is watching, and what do they already believe?', 'Audience:']) &&
          anyAnswered(direction, ['The one thing they should understand or do afterwards:', 'Takeaway:'])) ||
        decided('Intent'),
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
      done: (spine && !!(sb.treatment || sb.lens || typeof sb.theme === 'object')) || decided('Story', 'Look', 'Spine'),
      detail: `${sb.treatment ? `treatment ${sb.treatment}` : 'no treatment'}; spine ${spine ? 'written' : 'not written'}`,
      question: 'Does the story spine (question, turn, payoff) and the look fit what you want?',
    },
    {
      id: 'script',
      name: 'Narration',
      ask: true,
      // A one-shot film without a budget closes on the free draft voice and a logged decision.
      done:
        narrated > 0 &&
        (pending.filter(r => r.kind === 'voice').length === 0 || (drafted && decided('Narration', 'Script'))),
      detail: `${narrated} narrated beat(s); ${pending.some(r => r.kind === 'voice') ? (drafted ? 'draft voice only' : 'not yet voiced') : 'voiced'}`,
      question: 'Read the narration aloud: are these the words, before the voice is recorded?',
    },
    {
      id: 'rough',
      name: 'Rough cut',
      ask: true,
      done: rough.closed,
      decision: rough.human ?? rough.agent ?? null,
      detail: rough.latest
        ? [
            `${rough.latest.id} (${rough.latest.placeholders?.length ?? 0} placeholder(s))`,
            rough.human || rough.agent ? said(rough.human ?? rough.agent) : null,
            rough.notes.length ? `${rough.notes.length} note(s) from the person` : 'no notes from the person yet',
          ]
            .filter(Boolean)
            .join('; ')
        : 'no rough cut yet (draft DIR --rough)',
      question: 'Watch the rough cut (review/index.html): what feels wrong, where? Notes can name a time; say what to keep.',
    },
    {
      id: 'spend',
      name: 'Spend',
      ask: true,
      done: owed === 0 || decided('Spend', 'Budget'),
      detail: owed
        ? `≈ $${owed.toFixed(2)} of paid generation pending${sb.budget != null ? ` (budget $${sb.budget})` : ''}${decided('Spend', 'Budget') ? '; decision logged' : ''}`
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
      // The film must be current and measured, and someone must have said yes to it.
      done: video > edited && !timing.estimated && final.closed,
      decision: final.human ?? final.agent ?? null,
      detail: video
        ? timing.estimated
          ? 'rendered with an estimated voice'
          : video > edited
            ? `final is current; ${final.human || final.agent ? said(final.human ?? final.agent) : 'not accepted yet (applied is not accepted)'}`
            : 'storyboard changed since the render'
        : 'not rendered',
      question: 'Watch the final: ship it?',
    },
  ];
}
