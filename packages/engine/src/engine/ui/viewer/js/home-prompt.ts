import type { FilmForm, MadeFilm } from './00-boundary-films.js';

import { homeState } from './home-model.js';

// ---------------------------------------------------------------- making the film
export const REPLACE_SAMPLES =
  'starts from a playbook with sample scenes, narration, numbers and sources. Replace all of it with this film\'s own: rewrite or replace every scene and its narration, remove sample figures and sources, and group the work into a few clearly labelled edits. Keep it a film rather than slides: choose pictures that fit this material and audience (the authoring guide lists them — a cast of objects, a stage, a world, charts, sketches, cards) and build them in this first cut, since they take one edit each. Mark a scene "placeholder" only when its picture needs bespoke drawing or imagery; never leave sample content.';

export const TOGETHER_ASK =
  'We are building this together. Read the brief and sources, then propose a short plan: the scenes in order (one line each, with what the picture does), the look, and the voice. If the material supports genuinely different ways to show it (for example a cast of the things involved, a system stage, a journey through one world, or the numbers moving), offer two or three in a line each, say who each suits, and recommend one; a different palette is not a different direction. Change nothing yet; end by asking me to confirm or adjust.';

export const ONESHOT_ASK =
  'Start with clearframe_guide topic authoring (short). Then make the first cut I can watch: queue a rough cut with clearframe_render (kind draft), follow it with clearframe_job until it finishes, fix any engine errors it reports and queue it again if needed. Finish by telling me briefly, in plain words, what the cut contains and which scenes are still placeholders. I will watch it and leave notes on the moments I want changed.';

/** Where the person's files went in the project, for the first message. */
export function sourcesLine(f: FilmForm, film: MadeFilm): string | null {
  if (!f.documents?.length) return null;
  const names = (film.files ?? []).map((x) => x.name);
  const docs = names.filter((n) => /^source\//.test(n)).join(', ') || 'source/',
    media =
      names.filter((n) => /^assets\/uploads\//.test(n)).join(', ') || 'none';
  return `Files I gave (${f.documents.join(', ')}) are in the project: documents as ${docs} (summarised in BRIEF.md and EVIDENCE.md), pictures and media in ${media}. Read the documents with clearframe_files before writing; tie every number to its source.`;
}

/** The form's own words, one line each, empty where the person left a field blank. */
export function briefLines(f: FilmForm): string[] {
  const title = (f.title ?? '').trim(),
    audience = (f.audience ?? '').trim(),
    takeaway = (f.takeaway ?? '').trim();
  return [
    `Make this film: ${(f.idea ?? '').trim() || '(see the source documents)'}`,
    title && `Title: ${title}`,
    `Format: ${f.format === 'vertical' ? 'vertical 9:16' : 'landscape 16:9'}`,
    audience && `Audience: ${audience}`,
    takeaway && `Takeaway: ${takeaway}`,
  ];
}

/** The first message: the idea in the person's words, and what to do with the starter project. */
export function firstMessage(f: FilmForm, film: MadeFilm): string {
  const pb = homeState.project.catalog?.playbooks?.find(
      (p) => p.id === f.playbook,
    ),
    tr = homeState.project.catalog?.treatments?.find(
      (t) => t.id === f.treatment,
    );
  return [
    ...briefLines(f),
    pb
      ? `Starting structure: ${pb.title ?? pb.id}`
      : 'Starting structure: your choice (the project started from a general starter)',
    tr ? `Look: ${tr.title ?? tr.id}` : null,
    sourcesLine(f, film),
    '',
    `The project "${film.title}" ${REPLACE_SAMPLES}`,
    f.mode === 'together' ? TOGETHER_ASK : ONESHOT_ASK,
  ]
    .filter((x) => x != null && x !== '')
    .join('\n');
}
