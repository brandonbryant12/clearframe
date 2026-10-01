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
import { listRevisions, loadRevision, workingContent } from './revisions.mjs';
import { readDecisions, readNotes, acceptance } from './notes.mjs';
import { sha256File } from './store.mjs';

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

// A decision about a whole cut (not one note's result or some beats), for this checkpoint.
const wholeCut = (d, checkpoint) => !d.scope?.note && !d.scope?.beats && (!d.scope?.checkpoint || d.scope.checkpoint === checkpoint);
const newest = list => [...list].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).at(-1) ?? null;

/**
 * The rough-cut look happened when the person steered a rough or draft cut: their notes on it,
 * or their acceptance of the whole cut (a later rejection of it takes that back). In one-shot
 * work an agent decision for this checkpoint stands in, labelled as such.
 */
function roughMilestone(root, { mode }) {
  const watched = listRevisions(root).filter(r => (r.videos ?? []).some(v => ['rough', 'draft'].includes(v.profile)));
  const ids = new Set(watched.map(r => r.id));
  const ds = readDecisions(root).filter(d => ids.has(d.revision));
  const verdict = newest(ds.filter(d => d.role === 'human' && ['accept', 'reject'].includes(d.action) && wholeCut(d, 'rough')));
  const agent = newest(ds.filter(d => d.role === 'agent' && d.action === 'decide' && d.scope?.checkpoint === 'rough'));
  const notes = readNotes(root).filter(n => n.author?.role === 'human' && ids.has(n.revision));
  const human = verdict?.action === 'accept' ? verdict : null;
  const closed = !!human || notes.length > 0 || (mode === 'one-shot' && !!agent && verdict?.action !== 'reject');
  return { latest: watched.at(-1) ?? null, human, agent, verdict, notes, closed };
}

/**
 * Final is closed only for the film as it is now: a final encode of exactly the current content
 * (same inputs, renderer and fonts as the working copy, so an audio-only change reopens it),
 * that encode being build/video.mp4, and a decision about that whole cut and that encode — a
 * person's acceptance (a later rejection reopens it), or in one-shot work an agent decision for
 * the final. Acceptance of an earlier cut, of one note's result or of some beats never counts.
 */
export function finalMilestone(root, { mode = 'guided' } = {}) {
  const finals = listRevisions(root).filter(r => (r.videos ?? []).some(v => v.profile === 'final'));
  if (!finals.length) return { state: 'none', closed: false, detail: 'not rendered' };
  let working;
  try {
    working = workingContent(root);
  } catch (e) {
    return { state: 'broken', closed: false, detail: `the working copy does not prepare (${String(e.message).split('\n')[0]})` };
  }
  const rev = [...finals].reverse().find(r => r.contentId === working.contentId);
  if (!rev) return { state: 'stale', closed: false, detail: `the film changed since the last final render (${finals.at(-1).id})` };
  const video = [...rev.videos].reverse().find(v => v.profile === 'final');
  const file = path.join(root, 'build', 'video.mp4');
  if (!(fs.existsSync(file) && sha256File(file) === video.sha256))
    return { state: 'output', closed: false, revision: rev.id, detail: `build/video.mp4 is not ${rev.id}'s final encode (render the final again)` };
  const ds = readDecisions(root).filter(d => d.revision === rev.id || d.contentId === rev.contentId);
  // A decision recorded before decisions named their encode counts only if it came after it.
  const sawIt = d => (d.videos ? d.videos.some(v => v.sha256 === video.sha256) : Date.parse(d.at) >= Date.parse(video.renderedAt));
  const verdict = newest(ds.filter(d => d.role === 'human' && ['accept', 'reject'].includes(d.action) && wholeCut(d, 'final') && sawIt(d)));
  const agent = newest(ds.filter(d => d.role === 'agent' && d.action === 'decide' && d.scope?.checkpoint === 'final' && sawIt(d)));
  const human = verdict?.action === 'accept' ? verdict : null;
  const closed = !!human || (mode === 'one-shot' && !!agent && verdict?.action !== 'reject');
  const detail =
    verdict?.action === 'reject'
      ? `final ${rev.id} was rejected by ${verdict.by} (${verdict.id})`
      : human
        ? `final ${rev.id} is current; accepted by ${human.by} (${human.id})`
        : agent
          ? `final ${rev.id} is current; decided by the agent (${agent.id}), not a person's acceptance${mode === 'one-shot' ? '' : ' (guided work needs the person)'}`
          : `final ${rev.id} is current; not accepted yet (applied is not accepted)`;
  return { state: 'current', closed, revision: rev.id, video: video.sha256, human, agent, verdict, detail };
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
  const edited = mtime(path.join(root, 'storyboard.json'));
  const timing = computeTiming(root);
  const decided = decisions(direction);
  const spine = anyAnswered(direction, ['The question the film answers:', 'Question:', 'Spine:']);
  const drafted = costs.rows.filter(r => r.kind === 'voice').every(r => r.status !== 'todo');
  const rough = roughMilestone(root, { mode });
  const final = finalMilestone(root, { mode });
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
      decision: rough.human ?? (rough.closed ? rough.agent : null) ?? null,
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
      // The final encode of the film as it is now, with measured words, that someone said yes to.
      done: final.closed && !timing.estimated,
      decision: final.closed ? (final.human ?? final.agent) : null,
      detail: timing.estimated && final.state === 'current' ? 'rendered with an estimated voice' : final.detail,
      question: 'Watch the final: ship it?',
    },
  ];
}
