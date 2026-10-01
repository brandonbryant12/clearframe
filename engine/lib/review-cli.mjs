// Command handlers for review and editing (see docs/editing.md). Each prints a short plain
// report; --json prints the structured result instead.
import fs from 'node:fs';
import path from 'node:path';
import { listRevisions, loadRevision, snapshot, impact, lineageOf, workingTimeline, latestRevision } from './revisions.mjs';
import {
  addNote,
  readNotes,
  importNotes,
  parseStamp,
  parseTime,
  formatTime,
  locate,
  anchorAt,
  addKeep,
  readKeeps,
  releaseKeep,
  addDecision,
  setNoteStatus,
  checkKeeps,
  readDecisions,
  KEEPS,
} from './notes.mjs';
import { revise, compareRevisions, rejectRevision, restoreRevision } from './edit-loop.mjs';
import { cutWords, uncut, splitBeat, mergeBeats, tightenPauses, readEdits, sentenceAround } from './recording.mjs';
import { paperEdit, applyPaperCuts } from './paper.mjs';
import { writeReviewPage } from './review-page.mjs';
import { readRunlog, runlogReport } from './runlog.mjs';
import { checkId } from './store.mjs';
import { wordKey } from './word-timing.mjs';

export const REVIEW = new Set([
  'paper',
  'revisions',
  'snapshot',
  'diff',
  'note',
  'notes',
  'revise',
  'compare',
  'page',
  'accept',
  'reject',
  'decide',
  'override',
  'keep',
  'keeps',
  'restore',
  'cut',
  'uncut',
  'split',
  'merge',
  'runlog',
]);

const rel = f => path.relative(process.cwd(), f);
const list = v => (v == null ? undefined : String(v).split(',').map(s => s.trim()).filter(Boolean));
const ms = n => (n >= 60000 ? `${Math.floor(n / 60000)} min ${Math.round((n % 60000) / 1000)} s` : `${(n / 1000).toFixed(1)} s`);
/** Who is asking: a named person (--by) or the agent itself (--agent). */
function who(o, { need } = {}) {
  if (o.agent && o.by) throw new Error('Use --by NAME for a person, or --agent for your own decision; not both.');
  if (o.agent) return { role: 'agent' };
  if (o.by) return { role: 'human', name: String(o.by).slice(0, 80) };
  if (need) throw new Error(`${need} needs --by NAME (the person) and --said "their words".`);
  return { role: 'agent' };
}
function rangeOf(o) {
  const m = /^(.+?)(?:-|\.\.)(.+)$/.exec(String(o.range));
  if (!m) throw new Error('--range is from-to, e.g. 1:10-1:20');
  return { from: parseTime(m[1]), to: parseTime(m[2]) };
}
function printImpact(r) {
  return [
    `${r.from} → ${r.to}`,
    ...r.summary.map(s => `  ${s}`),
    ...r.beats
      .filter(x => !['unchanged'].includes(x.status))
      .slice(0, 40)
      .map(x => `  ${x.status.padEnd(10)} ${x.id.padEnd(12)} ${(x.reasons ?? []).join('; ')}`),
  ].join('\n');
}

export async function reviewCommand(cmd, dir, o, opts, positionals) {
  const json = v => console.log(JSON.stringify(v, null, 2));

  if (cmd === 'range') {
    const { renderRange } = await import('../../fframes/render.mjs');
    let beats = list(o.beats);
    let span = o.range ? rangeOf(o) : {};
    if (o.note) {
      const n = readNotes(dir).find(x => x.id === checkId('note', o.note));
      if (!n) throw new Error(`No note ${o.note}.`);
      const { timeline } = await workingTimeline(dir);
      const where = locate(dir, n, { id: null, timeline });
      if (!where.beat) throw new Error(`Note ${n.id} is ${where.state}: ${where.reason}`);
      beats = [...new Set([where.beat, ...(n.anchor?.beats ?? []).filter(id => timeline.beats.some(b => b.id === id))])];
    }
    if (o.chapter) {
      const { timeline } = await workingTimeline(dir);
      beats = timeline.beats.filter(b => b.chapter === o.chapter).map(b => b.id);
      if (!beats.length) throw new Error(`No chapter "${o.chapter}".`);
    }
    const handles = o.handles == null ? 2 : Number(o.handles);
    const r = await renderRange(dir, { ...span, beats, handles, rough: !!o.rough, out: o.out, verify: !o['no-verify'] });
    if (o.json) return json(r);
    return console.log(
      [
        `preview: ${rel(r.output)} · frames ${r.range.frames[0]}–${r.range.frames[1]} of the film (${formatTime(r.range.seconds[0])}–${formatTime(r.range.seconds[1])}, ${r.frames} frames, ${r.seconds.toFixed(1)} s to render)`,
        `beats: ${r.beats.map(b => b.id).join(', ')}`,
        r.verified ? `clock: preview frames match the film at ${r.verified.map(v => `${v.film} (${Number.isFinite(v.psnr) ? v.psnr.toFixed(1) : '∞'} dB)`).join(' and ')}` : 'clock: not checked (--no-verify)',
        r.audio ? `audio: samples ${r.audio.samples[0]}–${r.audio.samples[1]} of the full mix (film ${r.audio.film?.integrated} LUFS; this stretch ${r.audio.stretch?.integrated} LUFS)` : 'audio: none',
        r.notValidated.placeholders.length ? `placeholders: ${r.notValidated.placeholders.map(p => p.beat).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  if (cmd === 'runlog') {
    const r = runlogReport(readRunlog(dir), listRevisions(dir));
    if (o.json) return json(r);
    if (!r.commands) return console.log('No commands logged yet (review/runlog.jsonl).');
    const lines = [
      `${r.commands} command(s) from ${r.firstAt.replace('T', ' ').slice(0, 19)} to ${r.lastAt.replace('T', ' ').slice(0, 19)} (${ms(r.wallMs)} wall clock)`,
      `measured command time ${ms(r.measuredMs)}${r.failed ? ` (${r.failed} failed)` : ''}; between commands ${ms(r.gapMs)} — not measured: authoring, reading, review or waiting, the log cannot tell which`,
      '',
      ...r.runs.map((x, i) => {
        const gap = i ? Date.parse(x.startedAt) - Date.parse(r.runs[i - 1].endedAt) : 0;
        return `${x.startedAt.slice(11, 19)}  ${x.cmd.padEnd(12)} ${ms(x.ms).padStart(10)}${x.status === 'failed' ? '  failed' : ''}${x.revision ? `  → ${x.revision}` : ''}${gap > 1000 ? `   (gap ${ms(gap)})` : ''}`;
      }),
      '',
      'Phases (measured, all commands):',
      ...Object.entries(r.phases)
        .sort((a, b) => b[1].ms - a[1].ms)
        .map(([k, v]) => `  ${k.padEnd(16)} ${ms(v.ms).padStart(10)}  ×${v.count}`),
      '',
      ...Object.entries(r.milestones).map(([k, m]) =>
        m ? `${k}: ${m.revision}, ${ms(m.sinceFirstCommandMs)} after the first logged command (wall clock, includes gaps)` : `${k}: not yet`,
      ),
    ];
    return console.log(lines.join('\n'));
  }

  if (cmd === 'paper') {
    const r = paperEdit(dir, { suggest: !!o['suggest-cuts'] });
    return console.log(`${rel(r.file)} (${r.beats} beats${r.suggestions != null ? `, ${r.suggestions} suggested cut(s), none applied` : ''})`);
  }

  if (cmd === 'revisions') {
    const revs = listRevisions(dir);
    if (o.json) return json(revs);
    if (!revs.length) return console.log('No revisions yet. Every render saves one; snapshot DIR saves the working copy.');
    return console.log(
      revs
        .map(r => {
          const v = (r.videos ?? []).find(x => x.retained !== false);
          return `${r.id}  ${r.createdAt.replace('T', ' ').slice(0, 16)}  ${r.kind.padEnd(13)} ${(v ? v.profile : (r.videos ?? []).length ? 'released' : r.previews?.length ? 'previews' : '—').padEnd(9)} ${r.label ?? ''}${r.reason ? ` ${r.reason}` : ''}${r.placeholders?.length ? `  [${r.placeholders.length} placeholder(s)]` : ''}`;
        })
        .join('\n'),
    );
  }

  if (cmd === 'snapshot') {
    const { revision, created } = await snapshot(dir, { kind: 'snapshot', label: o.label, reason: o.reason });
    writeReviewPage(dir);
    return console.log(created ? `Saved ${revision.id} (no video; render to watch it).` : `Nothing changed since ${revision.id}.`);
  }

  if (cmd === 'diff') {
    const [a, b] = positionals.slice(1);
    const from = a ? loadRevision(dir, checkId('revision', a)) : (() => {
      const latest = latestRevision(dir);
      if (!latest) throw new Error('No revisions yet.');
      return loadRevision(dir, latest.id);
    })();
    let B, lineage;
    if (!b || b === 'working') {
      B = (await workingTimeline(dir)).timeline;
      lineage = lineageOf(from.timeline, B, readEdits(dir));
    } else {
      const x = loadRevision(dir, checkId('revision', b));
      B = x.timeline;
      lineage = x.meta.parent === from.meta.id ? x.meta.lineage : lineageOf(from.timeline, B, readEdits(dir));
    }
    const r = impact(from.timeline, B, { lineage, from: from.meta.id, to: b ?? 'working' });
    const keeps = !b || b === 'working' ? checkKeeps(dir, B) : [];
    if (o.json) return json({ ...r, keeps });
    return console.log(printImpact(r) + (keeps.length ? `\nKeeps broken:\n${keeps.map(k => `  ${k.keep} (${k.what}): ${k.message}`).join('\n')}` : ''));
  }

  if (cmd === 'note') {
    const raw = positionals.slice(1).join(' ');
    const stamp = parseStamp(raw);
    const at = stamp?.at ?? opts.at;
    const n = addNote(dir, {
      text: stamp?.text ?? raw,
      revision: stamp?.revision ?? o.rev,
      at,
      to: o.to != null ? parseTime(o.to) : stamp?.to,
      beat: o.beat ?? stamp?.beat,
      element: o.element,
      keep: list(o.keep) ?? [],
      scope: o.scope,
      by: o.by,
      agent: !!o.agent,
      via: stamp ? 'page' : 'cli',
    });
    writeReviewPage(dir);
    if (o.json) return json(n);
    const a = n.anchor;
    return console.log(
      [
        `${n.id} on ${n.revision}${o.rev || stamp ? '' : (loadRevision(dir, n.revision).meta.videos ?? []).length ? ' (the newest cut with a video; pass --rev if the person watched another)' : ' (the newest revision; it has no video, so pass --rev if the person watched something else)'}: ${n.scope}`,
        a
          ? `  ${a.beat}${a.beats?.length > 1 ? ` (+ ${a.beats.length - 1} more)` : ''} at ${formatTime(a.at)}${a.to != null ? `–${formatTime(a.to)}` : ''}${a.words ? ` · “${a.words}”` : ''}${a.source ? ` · recording ${formatTime(a.source.original[0])}–${formatTime(a.source.original[1])}` : ''}${a.element ? ` · element ${a.element}` : ''}`
          : '  the whole film',
        ...(a?.near?.length ? [`  near the cut to ${a.near.map(x => x.beat).join(', ')}: if the person meant that beat, add --beat ID`] : []),
        ...(n.keep.length ? [`  keeps: ${readKeeps(dir).filter(k => k.note === n.id).map(k => `${k.id} (${k.what})`).join(', ')}`] : []),
      ].join('\n'),
    );
  }

  if (cmd === 'notes') {
    if (o.import) {
      const data = JSON.parse(fs.readFileSync(o.import, 'utf8'));
      const added = importNotes(dir, data, { by: o.by });
      writeReviewPage(dir);
      return console.log(`Imported ${added.length} note(s): ${added.map(n => `${n.id} (${n.anchor?.beat ?? 'film'})`).join(', ')}`);
    }
    const notes = readNotes(dir);
    const latest = latestRevision(dir);
    const target = o.working ? { id: null, timeline: (await workingTimeline(dir)).timeline } : latest ? { id: latest.id, timeline: loadRevision(dir, latest.id).timeline } : null;
    const rows = notes
      .filter(n => !o.status || n.status === o.status)
      .map(n => {
        let where;
        try {
          where = target ? locate(dir, n, target) : { state: 'current' };
        } catch (e) {
          where = { state: 'unknown', reason: e.message };
        }
        return { ...n, where };
      });
    if (o.json) return json(rows);
    if (!rows.length) return console.log('No notes.');
    return console.log(
      [
        `where each note is in ${target?.id ?? 'the working copy'}:`,
        ...rows.map(
          n =>
            `${n.id} ${n.status.padEnd(9)} ${n.where.state.padEnd(9)} ${n.revision}${n.anchor ? ` ${formatTime(n.anchor.at)} ${n.anchor.beat}` : ' film'}${n.where.beat && n.where.beat !== n.anchor?.beat ? ` → ${n.where.beat}` : ''}${n.where.at != null && n.anchor && Math.abs(n.where.at - n.anchor.at) > 0.01 ? ` @ ${formatTime(n.where.at)}` : ''}  ${n.text.split('\n')[0].slice(0, 80)}${n.where.reason ? `\n      ${n.where.reason}` : ''}`,
        ),
      ].join('\n'),
    );
  }

  if (cmd === 'revise') {
    if (!o.note) throw new Error('revise needs --note n001 (record the note first).');
    const r = await revise(dir, {
      note: o.note,
      scope: o.scope,
      reason: o.reason,
      handles: o.handles == null ? 2 : Number(o.handles),
      overrides: list(o.override) ?? [],
      label: o.label,
    });
    if (o.json) return json(r);
    return console.log(
      [
        `candidate ${r.revision} for ${r.note} (applied, not accepted) · scope ${r.declared.film ? 'film' : r.declared.beats.join(', ')}`,
        printImpact(r.report),
        ...r.passages.map(
          (p, i) =>
            `passage ${i + 1}: ${p.beats.join(', ')}${p.removed.length ? ` (removed ${p.removed.join(', ')})` : ''}\n  before ${p.before ? rel(p.before.output) : '—'}\n  after  ${p.after ? rel(p.after.output) : '—'}${p.after?.verified ? `  (clock checked: ${p.after.verified.map(v => `${Number.isFinite(v.psnr) ? v.psnr.toFixed(1) : '∞'} dB`).join(', ')})` : ''}`,
        ),
        `compare page: ${rel(r.page)}`,
        'Ask the person to accept, refine or reject it; record their reply with accept/reject.',
      ].join('\n'),
    );
  }

  if (cmd === 'compare') {
    const [a, b] = positionals.slice(1);
    if (!a) throw new Error('compare needs a revision: compare DIR r003 [r004]');
    const r = await compareRevisions(dir, { from: a, to: b, handles: o.handles == null ? 2 : Number(o.handles) });
    if (o.json) return json(r);
    return console.log(`${printImpact(r.report)}\ncompare page: ${rel(r.page)}`);
  }

  if (cmd === 'page') {
    const file = writeReviewPage(dir, { rev: o.rev ? checkId('revision', o.rev) : undefined });
    return console.log(file ? rel(file) : 'No revisions yet: render a draft first.');
  }

  if (cmd === 'accept' || cmd === 'reject') {
    const rev = checkId('revision', positionals[1] ?? '');
    const by = who(o, { need: cmd });
    if (by.role !== 'human') throw new Error(`${cmd} records a person's decision; in one-shot work use decide.`);
    if (cmd === 'reject') {
      const r = await rejectRevision(dir, { revision: rev, note: o.note, by: by.name, said: o.said });
      if (o.json) return json(r);
      return console.log(
        [
          `rejected ${rev} (${r.decision}); the state before is saved as ${r.restorePoint}`,
          r.restored.length ? `restored from ${r.parent}: ${r.restored.join(', ')}` : 'nothing restored',
          ...r.conflicts.map(c => `  left alone: ${c}`),
          o.note ? `${o.note} is open again.` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }
    const scope = o.note ? { note: checkId('note', o.note) } : o.beats ? { beats: list(o.beats) } : o.checkpoint ? { checkpoint: o.checkpoint } : {};
    const d = addDecision(dir, { action: 'accept', role: 'human', by: by.name, said: o.said, revision: rev, scope });
    if (o.note) setNoteStatus(dir, o.note, 'accepted', { revision: rev, by: by.name });
    writeReviewPage(dir);
    return console.log(`${d.id}: ${by.name} accepted ${rev}${o.note ? ` for ${o.note}` : o.beats ? ` (${o.beats})` : o.checkpoint ? ` as the ${o.checkpoint}` : ''}: “${o.said}”`);
  }

  if (cmd === 'decide') {
    const rev = checkId('revision', positionals[1] ?? '');
    if (!o.reason) throw new Error('decide needs --reason (what you decided and why).');
    if (o.by) throw new Error('decide records the agent’s own call; a person’s verdict is accept --by NAME.');
    const d = addDecision(dir, { action: 'decide', role: 'agent', reason: o.reason, revision: rev, scope: o.checkpoint ? { checkpoint: o.checkpoint } : {} });
    writeReviewPage(dir);
    return console.log(`${d.id}: agent decision on ${rev}${o.checkpoint ? ` (${o.checkpoint})` : ''}, recorded as an agent decision (not a person's acceptance).`);
  }

  if (cmd === 'override') {
    const by = who(o, { need: 'override' });
    if (by.role !== 'human') throw new Error('Only the person can lift their own keep.');
    const k = readKeeps(dir).find(x => x.id === checkId('keep', o.keep ?? ''));
    if (!k) throw new Error(`No keep ${o.keep}.`);
    const rev = o.rev ?? latestRevision(dir)?.id;
    const d = addDecision(dir, { action: 'override', role: 'human', by: by.name, said: o.said, revision: rev, scope: { keep: k.id } });
    return console.log(`${d.id}: ${by.name} allowed an edit that breaks ${k.id} (${k.what}). Pass --override ${k.id} to revise.`);
  }

  if (cmd === 'keep') {
    if (o.release) {
      const by = who(o, { need: 'keep --release' });
      const k = releaseKeep(dir, o.release, { by, said: o.said });
      writeReviewPage(dir);
      return console.log(`${k.id} (${k.what}) released by ${by.name}.`);
    }
    const what = positionals[1];
    if (!KEEPS.includes(what)) throw new Error(`keep what? ${KEEPS.join(' | ')}`);
    const by = who(o, { need: 'keep' });
    if (by.role !== 'human' && !o.reason) throw new Error('An agent keep needs --reason.');
    let beats = list(o.beats);
    const rev = o.rev ?? latestRevision(dir)?.id;
    if (!rev) throw new Error('No revision yet: render a draft or run snapshot.');
    const { timeline } = loadRevision(dir, checkId('revision', rev));
    if (opts.at != null) {
      const a = anchorAt(timeline, opts.at, { to: o.to != null ? parseTime(o.to) : undefined });
      beats = a.beats;
    }
    if (o.chapter) beats = timeline.beats.filter(b => b.chapter === o.chapter).map(b => b.id);
    const k = addKeep(dir, { what, beats: what === 'look' ? null : beats, revision: rev, by, said: o.said ?? o.reason });
    writeReviewPage(dir);
    return console.log(`${k.id}: keep ${what} for ${k.scope.film ? 'the whole film' : k.scope.beats.join(', ')} (from ${rev}). ${what === 'voice' ? 'The recording or take stays; cuts only when the person asks for them.' : ''}`);
  }

  if (cmd === 'keeps') {
    const keeps = readKeeps(dir);
    if (o.json) return json(keeps);
    return console.log(
      keeps.length
        ? keeps.map(k => `${k.id} ${k.active ? 'active  ' : 'released'} ${k.what.padEnd(8)} ${k.scope.film ? 'whole film' : k.scope.beats.join(', ')}  (${k.by?.name ?? k.by?.role}${k.said ? `: “${k.said}”` : ''})`).join('\n')
        : 'Nothing pinned.',
    );
  }

  if (cmd === 'restore') {
    const rev = checkId('revision', positionals[1] ?? '');
    const by = who(o);
    if (by.role === 'human' && !o.said) throw new Error('restore --by NAME needs --said "their words".');
    if (by.role === 'agent' && !o.reason) throw new Error('restore --agent needs --reason.');
    const r = await restoreRevision(dir, { revision: rev, beats: list(o.beats), by: by.name, said: o.said ?? o.reason, role: by.role });
    if (o.json) return json(r);
    return console.log(`restored ${r.restored.join(', ')} from ${rev}; the state before is ${r.restorePoint}, the restored state is ${r.now}. Undo with restore DIR ${r.restorePoint}.`);
  }

  if (cmd === 'cut') {
    const by = who(o);
    const common = { by, note: o.note ? checkId('note', o.note) : undefined, dryRun: !!o['dry-run'] };
    let result;
    if (o.paper) {
      // Struck words are the person's own marks: attribute them.
      if (by.role !== 'human' && !common.dryRun) throw new Error('cut --paper applies a person’s marks: pass --by NAME.');
      const { paperCuts } = await import('./paper.mjs');
      const order = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8')).beats.map(b => b.id);
      const touched = paperCuts(dir, o.paper).flatMap(r => order.slice(order.indexOf(r.from.beat), order.indexOf(r.to.beat) + 1));
      guardKeeps(dir, touched, common, o);
      result = common.dryRun ? [] : applyPaperCuts(dir, o.paper, common);
      if (!result.length) return console.log(common.dryRun ? `would cut struck words in ${[...new Set(touched)].join(', ') || 'nothing'}` : 'No struck words (~~…~~) that differ from the film as it plays now.');
    } else if (o['pauses-over'] != null) {
      const args = { over: Number(o['pauses-over']), keep: o['keep-pause'] == null ? 0.5 : Number(o['keep-pause']), beats: list(o.beats) };
      guardKeeps(dir, tightenPauses(dir, args, { ...common, dryRun: true }).beats.map(p => p.beat), common, o);
      result = [tightenPauses(dir, args, common)];
    } else {
      let sel;
      if (o.words) sel = { words: o.words, beat: o.beat, nth: o.nth == null ? undefined : Number(o.nth) };
      else if (o.sentence != null) sel = { beat: checkId('beat', o.beat ?? ''), sentence: Number(o.sentence) };
      else if (opts.at != null || o.note) sel = await sentenceSelection(dir, o, opts);
      else throw new Error('cut what? --words "…", --beat ID --sentence N, --at TIME, --note nNNN, --pauses-over S or --paper FILE');
      guardKeeps(dir, cutWords(dir, sel, { ...common, dryRun: true }).beats.map(p => p.beat), common, o);
      result = [cutWords(dir, sel, common)];
    }
    if (!common.dryRun) writeReviewPage(dir);
    if (o.json) return json(result);
    return console.log(
      result
        .map(
          r =>
            `${common.dryRun ? 'would cut' : r.id} ${r.op === 'pauses' ? `pauses over ${r.over} s down to ~${r.keep} s` : `“${r.words}”`}: ${r.frames} frame(s) (${r.seconds.toFixed(2)} s) from ${r.beats.map(p => `${p.beat}${p.deleted ? ' (whole beat)' : ''}`).join(', ') || 'nothing'}${common.dryRun ? '' : `; later beats move ${r.seconds.toFixed(2)} s earlier. Undo: uncut DIR --cut ${r.id}`}`,
        )
        .join('\n'),
    );
  }

  if (cmd === 'uncut') {
    const r = uncut(dir, { id: o.cut, beat: o.beat }, { by: who(o) });
    return console.log(`${r.id}: restored ${r.beats.join(', ') || 'nothing'} from the recording (undid ${r.of.join(', ')}).`);
  }
  if (cmd === 'split') {
    if (!o.beat || !o.before) throw new Error('split needs --beat ID --before "first words of the second part"');
    const r = splitBeat(dir, { beat: o.beat, at: o.before, nth: o.nth == null ? undefined : Number(o.nth) }, { by: who(o) });
    return console.log(`${o.beat} → ${r.into.join(' + ')} (both keep its picture; give the second its own).`);
  }
  if (cmd === 'merge') {
    const ids = positionals.slice(1, 3);
    if (ids.length !== 2) throw new Error('merge needs two adjacent beat ids.');
    const r = mergeBeats(dir, { beats: ids }, { by: who(o) });
    return console.log(`${ids.join(' + ')} → ${r.into} (the picture of ${ids[1]} is kept in review/edits.jsonl, not on screen).`);
  }
  throw new Error(`Unknown review command ${cmd}`);
}

/**
 * The sentence a person pointed at (by time on the revision they watched, or through a note),
 * found again by its words in the film as it is now. Never the nearest timestamp.
 */
async function sentenceSelection(dir, o, opts) {
  let rev, at, note;
  if (o.note) {
    note = readNotes(dir).find(n => n.id === checkId('note', o.note));
    if (!note?.anchor) throw new Error(`Note ${o.note} has no moment to cut.`);
    rev = note.revision;
    at = note.anchor.words ? null : note.anchor.at;
  } else {
    rev = o.rev ?? [...listRevisions(dir)].reverse().find(r => (r.videos ?? []).length)?.id;
    at = opts.at;
  }
  if (!rev) throw new Error('No revision to read the time against; pass --rev.');
  const { timeline } = loadRevision(dir, checkId('revision', rev));
  const anchor = note?.anchor ?? anchorAt(timeline, at);
  // The sentence around the anchor, in the revision the person watched.
  const words = timeline.beats.flatMap(b => b.words.map((w, k) => ({ ...w, beat: b.id, k })));
  const inBeat = words.filter(w => w.beat === anchor.beat);
  const quoteStart = anchor.words ? inBeat.findIndex((w, k) => anchor.words.split(' ').every((q, j) => inBeat[k + j] && wordKey(inBeat[k + j].w) === wordKey(q))) : -1;
  const pos = quoteStart >= 0 ? words.indexOf(inBeat[quoteStart + Math.min(2, anchor.words.split(' ').length - 1)]) : words.findIndex(w => w.beat === anchor.beat && w.t1 > anchor.at);
  if (pos < 0) throw new Error(`No words at that moment of ${rev}.`);
  const [a, b] = sentenceAround(words, pos);
  const text = words
    .slice(a, b + 1)
    .map(w => w.w)
    .join(' ');
  return { words: text, revision: rev };
}

/** A cut must not break a keep: `voice` allows cuts the person asked for; `words` never. */
function guardKeeps(dir, beats, common, o) {
  const touched = new Set(beats);
  const granted = new Set(readDecisions(dir).filter(d => d.action === 'override' && d.role === 'human').map(d => d.scope?.keep));
  const overrides = new Set(list(o.override) ?? []);
  for (const k of readKeeps(dir).filter(k => k.active && ['voice', 'words'].includes(k.what))) {
    if (!(k.scope.film || k.scope.beats.some(id => touched.has(id)))) continue;
    if (overrides.has(k.id) && granted.has(k.id)) continue;
    if (k.what === 'voice' && common.by.role === 'human') continue;
    throw new Error(
      k.what === 'voice'
        ? `${k.id} keeps the voice here (“${k.said ?? ''}”); a cut needs the person's request: pass --by NAME with what they asked.`
        : `${k.id} keeps the words here (“${k.said ?? ''}”). Ask the person; if they agree: override DIR --keep ${k.id} --by NAME --said "…", then cut … --override ${k.id}.`,
    );
  }
}
