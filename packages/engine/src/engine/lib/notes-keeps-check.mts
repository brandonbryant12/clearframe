import { editParts, readEdits, type EditEntry } from './recording-model.mjs';
import { sliceProblem } from './recording-slices.mjs';
import {
  currentSource,
  uncovered,
  revisionMaster,
  type CurrentSource,
  type ProtectedSource,
} from './targets.mjs';
import { factsPrint, type Timeline, type TimelineBeat } from './revisions.mjs';

import { keysOf, locate } from './notes-locate.mjs';

import type { BeatBaseline, Keep } from './notes-model.mjs';

import type { Storyboard } from '../domain.mjs';
import type { KeepViolation } from './notes-keeps-contracts.mjs';
import {
  type RecordingNow,
  recordingNow,
  personRemoved,
  byHuman,
} from './notes-keeps-recording.mjs';

/** Lazily read state shared by every keep of one check. */
export class KeepCheck {
  readonly violations: KeepViolation[] = [];
  readonly edits: EditEntry[];
  private nowSource: CurrentSource | null = null;
  private master: RecordingNow | null = null;
  private byPerson: number[][] | null = null;
  private readonly audited = new Map<string, string | null>();
  private readonly root: string;
  private readonly timeline: Timeline;

  constructor(root: string, timeline: Timeline) {
    this.root = root;
    this.timeline = timeline;
    this.edits = readEdits(root);
  }

  now(): CurrentSource {
    this.nowSource ??= currentSource(this.root);
    return this.nowSource;
  }

  look(k: Keep): void {
    if (k.baseline.look !== this.timeline.film.look)
      this.violations.push({
        keep: k.id,
        what: 'look',
        message:
          'the film look changed (palette, motion, captions, framing or format)',
      });
  }

  words(k: Keep, prot: ProtectedSource): void {
    const now = this.now();
    for (const [id, p] of Object.entries(prot)) {
      const gone = p.words.filter((i) => !now.words.has(i));
      if (gone.length)
        this.violations.push({
          keep: k.id,
          what: 'words',
          beat: id,
          message: `words of ${id} no longer play (“${gone
            .slice(0, 8)
            .map((i) => now.transcript?.words[i].w)
            .join(' ')}”)`,
        });
    }
  }

  voice(k: Keep, prot: ProtectedSource): void {
    // The recording itself first: slices can only be checked against the right master.
    this.master ??= recordingNow(this.root);
    const master = this.master;
    const played = revisionMaster(this.root, k.revision);
    const wrong =
      master.problem ??
      (played && played !== master.sha
        ? `source/recording.wav is not the recording ${k.revision} played: it was replaced`
        : null);
    if (wrong) {
      this.violations.push({
        keep: k.id,
        what: 'voice',
        message: `${wrong} (${Object.keys(prot).join(', ')})`,
      });
      return;
    }
    const now = this.now();
    this.byPerson ??= personRemoved(now, this.edits);
    for (const [id, p] of Object.entries(prot))
      this.voiceOf(k, id, p.spans, now, master);
  }

  private voiceOf(
    k: Keep,
    id: string,
    spans: number[][],
    now: CurrentSource,
    master: RecordingNow,
  ): void {
    const missing = spans.flatMap((span) => uncovered(span, now.spans));
    const unexplained = missing.flatMap((span) =>
      uncovered(span, this.byPerson ?? []),
    );
    if (unexplained.length)
      this.violations.push({
        keep: k.id,
        what: 'voice',
        beat: id,
        message: `${id} no longer plays all of its recording: cut without the person asking, or replaced`,
      });
    // What plays it now (the beat, its parts, or the beat it merged into) must be the recording.
    for (const x of now.beats.filter((y) =>
      y.spans.some(([a, b]) => spans.some(([c, d]) => a < d && b > c)),
    )) {
      if (!this.audited.has(x.id))
        this.audited.set(
          x.id,
          master.src
            ? sliceProblem(this.root, x.id, x.meta, master.src, now.fps)
            : 'source/recording.wav cannot be read',
        );
      const why = this.audited.get(x.id);
      if (why)
        this.violations.push({
          keep: k.id,
          what: 'voice',
          beat: id,
          message: `${x.id === id ? id : `${x.id} (playing ${id}'s recording)`} does not play the recording: ${why}`,
        });
    }
  }

  /** Beats not judged by their recording, followed through splits and merges since the keep. */
  beats(k: Keep, prot: ProtectedSource, sbK: Storyboard | null): void {
    const target = { id: null, timeline: this.timeline };
    for (const [id, base] of Object.entries(k.baseline)) {
      if (prot[id] || typeof base === 'string') continue; // judged by its recording above
      const where = locate(
        this.root,
        {
          revision: k.revision,
          scope: 'beat',
          anchor: {
            beat: id,
            beats: [id],
            words: '',
            at: 0,
            beatTime: 0,
            prints: {},
          },
        },
        target,
      );
      const now = this.timeline.beats.filter(
        (b) => b.id === where.beat || (b.was ?? []).includes(id),
      );
      const say = (m: string): void => {
        this.violations.push({
          keep: k.id,
          what: k.what,
          beat: id,
          message: m,
        });
      };
      if (!now.length) this.removed(k, id, say);
      else this.changed(k, id, base, now, sbK, say);
    }
  }

  private removed(k: Keep, id: string, say: (m: string) => void): void {
    const cut = this.edits.find(
      (e) =>
        e.op === 'cut' && editParts(e).some((p) => p.beat === id && p.deleted),
    );
    if (
      k.what === 'voice' &&
      cut &&
      byHuman(this.edits.find((x) => x.id === cut.id))
    )
      return;
    say(`${id} was removed${cut ? ` by ${cut.id}` : ''}`);
  }

  private changedVoice(
    id: string,
    base: BeatBaseline,
    now: TimelineBeat[],
    say: (m: string) => void,
  ): void {
    if (now.some((b) => b.prints.voice !== base.voice))
      say(`${id} no longer plays the same take`);
    else if (now.some((b) => b.prints.audio !== base.audio))
      say(`the audio of ${id} changed`);
  }
  private changed(
    k: Keep,
    id: string,
    base: BeatBaseline,
    now: TimelineBeat[],
    sbK: Storyboard | null,
    say: (m: string) => void,
  ): void {
    if (k.what === 'words') {
      const text = now.map((b) => keysOf(b.vo?.text ?? '').join(' ')).join(' ');
      if (text !== base.words) say(`the words of ${id} changed`);
    } else if (k.what === 'facts' || k.what === 'picture') {
      const beatK = sbK?.beats?.find((b) => b.id === id);
      const want =
        k.what === 'facts' && beatK
          ? factsPrint(beatK, sbK?.sources ?? [])
          : base[k.what];
      const what = k.what;
      if (now.some((b) => b.prints[what] !== want))
        say(
          `the ${what === 'facts' ? 'facts shown (figures, labels, units, wording or attribution)' : 'picture'} of ${id} changed`,
        );
    } else if (k.what === 'voice') {
      // Narration that is not an imported recording: its take, and the audio cut from it.
      this.changedVoice(id, base, now, say);
    }
  }
}
