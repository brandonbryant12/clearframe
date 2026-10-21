import { fingerprint } from './store.mjs';

import { factsPrint } from './revisions-facts.mjs';
import type { VoMeta } from './recording-model.mjs';
import type { BeatPrints } from './revisions-model.mjs';
import type { Beat } from '../domain.mjs';
import type {
  Recorded,
  Shared,
  BeatInputs,
} from './revisions-timeline-contracts.mjs';
import {
  mediaKeys,
  round,
  settle,
  pick,
  PICTURE_KEYS,
} from './revisions-timeline-common.mjs';

export function voicePrint(
  b: Partial<Beat>,
  recorded: Recorded | null,
  meta: VoMeta | null,
  wav: string | null,
  sourceSha: string | null,
): string | null {
  if (!b.vo) return null;
  if (recorded) return fingerprint({ recording: sourceSha });
  if (meta?.provider)
    return fingerprint({
      provider: meta.provider,
      take: meta.take?.hash ?? meta.hash ?? wav,
    });
  return fingerprint({ unrecorded: true });
}

export function prints(
  s: Shared,
  { jb, tb, b, meta, recorded }: BeatInputs,
  prevOwn: string | null,
): BeatPrints {
  const wav = s.ctx.manifest.hashes[`assets/vo/${jb.id}.wav`] ?? null;
  const media = mediaKeys(jb);
  // Voice levels are drawn from the beat's audio (in `audio` below), sampled from an
  // absolute offset; they are identified by that audio rather than by their jittered values.
  const { start_frame: _startFrame, levels, ...placeless } = jb;
  const audio = wav
    ? fingerprint({
        wav,
        lead: tb.vo ? round(tb.vo.start - tb.start, 2) : null,
      })
    : null;
  const own = fingerprint({
    beat: settle(placeless),
    film: s.jobFilm,
    levels: levels ? audio : null,
  });
  return {
    authored: fingerprint({ beat: b, wav, words: meta?.words ?? null, media }),
    own,
    rendered: fingerprint({
      own,
      renderer: s.film.renderer,
      prev: jb.transition !== 'cut' ? prevOwn : null,
    }),
    picture: fingerprint({ beat: pick(b, PICTURE_KEYS), media }),
    words: fingerprint({ vo: b.vo ?? null, speaker: b.speaker ?? null }),
    audio,
    voice: voicePrint(b, recorded, meta, wav, s.sourceSha),
    facts: factsPrint(b, s.sources),
  };
}
