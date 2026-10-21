import fs from 'node:fs';
import path from 'node:path';
import { studioState, studioSchema } from '../viewer/studio.mjs';
import { loadViewerNotes } from '../viewer/notes.mjs';
import { decodeStoryboard } from '../../schemas.mjs';
import type { ToolOptions, ToolHandlers, ToolResult } from './contracts.mjs';
import { fail, clip, sec, TERMINAL, ROOT, GUIDES } from './tool-common.mjs';

type StudioSnapshot = ReturnType<typeof studioState>;
function formatDescription(timing: StudioSnapshot['timing']): string {
  if (!timing) return 'timing unavailable';
  const estimate = timing.estimated ? ' (narration timing estimated)' : '';
  return `${timing.width}×${timing.height} at ${timing.fps} fps, ${sec(timing.duration)}${estimate}; finals render at this size, rough cuts at half size (${Math.round(timing.width / 2)}×${Math.round(timing.height / 2)})`;
}
function readBeat(st: StudioSnapshot, beatId: string): ToolResult {
  const b = st.storyboard.beats.find((x) => x.id === beatId);
  if (!b)
    throw fail(
      `No scene ${beatId}. Scenes: ${st.storyboard.beats.map((x) => x.id).join(', ')}`,
    );
  const t = st.timing?.beats.find((x) => x.id === b.id);
  return {
    content: [
      `Scene ${b.id} (${t ? `${sec(t.start)}–${sec(t.end)}` : 'timing unavailable'}), narration: ${st.narration[b.id]?.kind}${st.narration[b.id]?.editable === false ? ' (not editable as text)' : ''}`,
      `Engine errors for it: ${st.errors.filter((e) => e.startsWith(`${b.id}:`)).join('; ') || 'none'}`,
      `Hash: ${st.hash}`,
      JSON.stringify(b, null, 1),
    ].join('\n'),
    metadata: { summary: `Read scene ${b.id}`, hash: st.hash },
  };
}
function filmLines(
  st: StudioSnapshot,
  noteCount: number,
  active: ReturnType<ToolOptions['jobs']['list']>,
  paused: ReturnType<ToolOptions['pauseOf']>,
) {
  const sb = st.storyboard,
    t = st.timing,
    f = sb.format ?? {};
  const lines = [
    `Film: ${sb.title} — project format ${formatDescription(t)}`,
    `Look: theme ${typeof sb.theme === 'string' ? sb.theme : (sb.theme?.base ?? 'default')}, type ${sb.type ?? 'default'}, motion ${sb.motion?.preset ?? sb.motion ?? 'default'}${sb.transition ? `, transition ${sb.transition}` : ''}${f.preset ? `, format ${f.preset}` : ''}`,
    `Hash: ${st.hash}  (pass this to clearframe_edit)`,
    `Undo: ${st.undoLabel ?? '—'} · Redo: ${st.redoLabel ?? '—'}${st.externalChanges ? ' · edited outside the studio' : ''}`,
    st.errors.length
      ? `Engine refuses this working copy:\n  ${st.errors.slice(0, 12).join('\n  ')}`
      : 'Engine accepts this working copy.',
    st.warnings.length
      ? `Warnings:\n  ${st.warnings.slice(0, 8).join('\n  ')}`
      : null,
    `Scenes (${sb.beats.length}):`,
    ...sb.beats.map((b, i) => {
      const bt = t?.beats.find((x) => x.id === b.id);
      return `${i + 1}. ${b.id} [${b.block}]${b.label ? ` "${b.label}"` : ''} ${bt ? `${sec(bt.start)}–${sec(bt.end)}` : ''}${b.placeholder ? ' PLACEHOLDER' : ''}${b.vo ? `\n   vo (${st.narration[b.id]?.kind}): ${clip(b.vo, 220)}` : ''}${b.props?.title ? `\n   title: ${clip(b.props.title, 120)}` : ''}`;
    }),
    st.changes
      ? `Since revision ${st.changes.revision}: ${[st.changes.edited.length && `edited ${st.changes.edited.join(', ')}`, st.changes.added.length && `added ${st.changes.added.join(', ')}`, st.changes.removed.length && `removed ${st.changes.removed.join(', ')}`, st.changes.film && 'film settings changed', st.changes.reordered && 'reordered'].filter(Boolean).join('; ') || 'no changes'}`
      : 'Not rendered yet.',
    `Open review notes: ${noteCount}${noteCount ? ' (clearframe_notes lists them)' : ''}`,
    active.length
      ? `Render jobs running or queued: ${active.map((j) => `${j.label} (${j.status})`).join(', ')}`
      : null,
    paused ? `Editing is paused while ${paused.label} runs.` : null,
  ].filter(Boolean);
  return lines;
}

export function createCatalogTools({
  jobs,
  filmOf,
  pauseOf,
}: ToolOptions): ToolHandlers {
  const filmId = (dir: string) => filmOf(dir)?.id;
  return {
    state({ dir, input }) {
      const st = studioState(dir),
        sb = st.storyboard;
      if (input.full)
        return {
          content: clip(JSON.stringify(sb, null, 1), 150000),
          metadata: {
            summary: `Read the whole storyboard (${sb.beats.length} scenes)`,
            hash: st.hash,
          },
        };
      if (input.beat) return readBeat(st, input.beat);
      const notes = (() => {
        try {
          return loadViewerNotes(dir).filter((n) => !n.resolved);
        } catch {
          return [];
        }
      })();
      const active = jobs
        .list(filmId(dir))
        .filter((j) => !TERMINAL.has(j.status));
      const lines = filmLines(st, notes.length, active, pauseOf(dir));
      return {
        content: lines.join('\n'),
        metadata: {
          summary: `${sb.beats.length} scenes · ${st.errors.length ? `${st.errors.length} engine errors` : 'engine accepts it'}`,
          hash: st.hash,
        },
      };
    },

    catalog({ dir, input }) {
      const s = studioSchema(),
        topic = input.topic;
      const catalog = {
        blocks: () =>
          s.blocks
            .map((b) => `${b.name} (${b.category}): ${b.summary}`)
            .join('\n'),
        block: () => {
          const b = s.blocks.find((x) => x.name === input.name);
          if (!b)
            throw fail(
              `No block ${input.name}. Blocks: ${s.blocks.map((x) => x.name).join(', ')}`,
            );
          return JSON.stringify(
            {
              name: b.name,
              summary: b.summary,
              props: b.props,
              example: b.example,
            },
            null,
            1,
          );
        },
        palettes: () => s.palettes.map((p) => `${p.id}: ${p.notes}`).join('\n'),
        types: () =>
          s.types
            .map((t) => `${t.id}: ${t.title} — ${t.when ?? ''}`)
            .join('\n'),
        treatments: () =>
          s.treatments
            .map((t) => `${t.id}: ${t.title} — ${t.when ?? ''}`)
            .join('\n'),
        sketches: () =>
          s.sketches
            .map(
              (k) =>
                `${k.id}${k.art ? ' (background art)' : ''}: ${k.summary ?? ''}${k.use ? ` Use: ${k.use}` : ''}`,
            )
            .join('\n'),
        canvas: () => JSON.stringify(s.canvas, null, 1),
        transitions: () => JSON.stringify(s.transitions),
        motions: () => JSON.stringify(s.motions),
        'film-fields': () => JSON.stringify(s.film, null, 1),
        'beat-fields': () => JSON.stringify(s.beat, null, 1),
        playbooks: async () =>
          (await import('../../../film/playbooks.mjs'))
            .playbooks()
            .map(
              (p) => `${p.id}: ${p.title} — ${p.audience}; inputs: ${p.inputs}`,
            )
            .join('\n'),
        // One search over the whole library (the project's own library/ included): a short mixed
        // shortlist with what each is and when it fits; `item` gives one entry's exact authoring.
        find: async () => {
          const { useProject } = await import('../../../film/library.mjs'),
            { find, line } = await import('../../../film/discover.mjs');
          useProject(dir);
          if (!input.query)
            throw fail(
              'find needs query: what the film should show or make someone feel, in plain words.',
            );
          const hits = find(input.query, { limit: 10 });
          return hits.length
            ? `${hits.map(line).join('\n')}\n\nclearframe_catalog topic item, name KIND:NAME, for the exact authoring of one.`
            : 'Nothing matched; try other words (a thing, a feeling, an audience).';
        },
        item: async () => {
          const { useProject } = await import('../../../film/library.mjs'),
            { detail } = await import('../../../film/discover.mjs');
          useProject(dir);
          return JSON.stringify(
            await detail(String(input.name ?? '')),
            null,
            1,
          );
        },
        // A sketch's drawn elements for this film's frame shape (words and moments filled), so the
        // picture itself can be adapted: copy them into props.elements and edit what the brief needs.
        sketch: async () => {
          const { useProject } = await import('../../../film/library.mjs'),
            { sketch } = await import('../../../film/sketches.mjs');
          useProject(dir);
          let framePreset = input.shape;
          if (!framePreset)
            try {
              framePreset = decodeStoryboard(
                JSON.parse(
                  fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'),
                ),
              ).format?.preset;
            } catch {}
          framePreset = ['vertical', 'portrait', 'square'].includes(
            framePreset ?? '',
          )
            ? framePreset
            : 'landscape';
          const drawn = sketch(String(input.name ?? ''), framePreset, {
            text: input.sketchText,
            say: input.sketchSay,
            params: input.sketchParams,
          });
          return JSON.stringify(
            {
              shape: framePreset,
              note: "This sketch drawn for this frame shape, with any sketchText and sketchSay filled. To change the picture itself, put these elements in a canvas beat's props.elements (instead of props.sketch) and edit only what the brief needs: icons, labels, positions, how many.",
              ...drawn,
            },
            null,
            1,
          );
        },
      };
      const out = Object.entries(catalog).find(([name]) => name === topic)?.[1];
      if (!out) throw fail('Unknown catalog topic.');
      return Promise.resolve(out()).then((text) => ({
        content: clip(text, 120000),
        metadata: {
          summary: `Looked up ${topic}${input.name ? ` ${input.name}` : ''}${input.query ? `: ${String(input.query).slice(0, 60)}` : ''}`,
        },
      }));
    },

    guide({ input }) {
      const file = Object.entries(GUIDES).find(
        ([name]) => name === input.topic,
      )?.[1];
      if (!file)
        throw fail(`Unknown guide. Topics: ${Object.keys(GUIDES).join(', ')}.`);
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
      return {
        content:
          text.length > 30000
            ? `${text.slice(0, 30000)}\n\n[Truncated at 30,000 of ${text.length.toLocaleString('en-US')} characters.]`
            : text,
        metadata: { summary: `Read the ${input.topic} guide` },
      };
    },
  };
}
