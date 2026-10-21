import { pullDrawing } from './job-pace-drawing.mjs';
import type {
  ResolvedStoryboard as Storyboard,
  TimedBeat as TimingBeat,
  Beat as StoryboardBeat,
} from '../engine/domain.mjs';
import type { JobReport, BlockProps, ArtLayers } from './types.mjs';
import { stagedItems, rules } from './registry.mjs';

/**
 * Pacing: the picture never waits for the voice. When a scene would sit empty for more than
 * ~0.7 s after its narration starts (every element cued to a late word), the first drawing is
 * pulled forward to the first word and reported; other blocks are reported. `pace: "hold"`
 * on a beat keeps a deliberate wait. World beats after the first already show the world.
 */
export function keepPace(
  b: TimingBeat,
  source: StoryboardBeat,
  props: BlockProps,
  art: ArtLayers | null,
  at: number,
  { sb, report }: { sb: Storyboard; report: JobReport },
) {
  const first = b.vo?.words?.find((w) => w.t1 > w.t0);
  if (!first || source.pace === 'hold') return;
  const voice = Math.max(0, first.t0 - b.start);
  if (continuingWorld(b, props, sb)) return;
  const own = b.block === 'canvas' ? (props.elements ?? []) : [];
  const layers = [...own, ...(art?.under ?? []), ...(art?.over ?? [])];
  const earliest = layers.length
    ? Math.min(...layers.map((el) => el.at ?? 0))
    : Infinity;
  // Sequence bodies arrive on their item cues, not the block cue. Highlight and annotate
  // already show text/an image before their staged markers, so keep their block cue.
  const staged = rules(b.block ?? '').staged;
  const itemCued = staged && !['highlight', 'annotate'].includes(b.block ?? '');
  const body = itemCued
    ? Math.min(...stagedItems(props, staged.key).map((it) => it.at ?? 0))
    : at;
  // An authored plate is already a picture behind the delayed information.
  const picture = source.plate || props.plates ? 0 : Infinity;
  const content = Math.min(
    b.block === 'canvas' ? earliest : Math.min(body, earliest),
    picture,
  );
  const allowance = b.block !== 'canvas' && props.title ? 1.6 : 0.7;
  const gap = content - voice;
  if (!(gap > allowance)) return;
  if (b.block === 'canvas' && own.length) {
    pullDrawing(b, own, content, voice, earliest, gap, report);
    return;
  }
  // Number blocks enter with the voice; their count still starts where it lands on its word.
  if (['stat', 'delta', 'ring', 'waffle'].includes(b.block ?? '')) {
    report.warnings.push(
      `${b.id}: the ${b.block} entered with the voice (${gap.toFixed(1)} s earlier than its count) so the scene is never empty; the figure still lands on its word.`,
    );
    return { cue: Math.max(0, voice - 0.1), count: at };
  }
  latePicture(b, gap, Boolean(itemCued), report);
}

function continuingWorld(
  b: TimingBeat,
  props: BlockProps,
  sb: Storyboard,
): boolean {
  return Boolean(
    b.block === 'canvas' &&
    props.world &&
    sb.beats
      .slice(0, b.index)
      .some((x) => x.block === 'canvas' && x.props?.world === props.world),
  );
}

function latePicture(
  b: TimingBeat,
  gap: number,
  itemCued: boolean,
  report: JobReport,
): void {
  report.warnings.push(
    `${b.id}: the voice starts ${gap.toFixed(1)} s before the ${itemCued ? 'first staged item' : 'picture'} arrives. ${itemCued ? 'Cue an item to the opening words (item say overrides land)' : `Cue the ${b.block} earlier (land on an earlier word)`}, or add a plate or art at: 0 with enter: "none" for the lead-in. Use pace: "hold" only for a reviewed, deliberate wait.`,
  );
}
