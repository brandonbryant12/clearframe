import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';
import type { Asset, Beat, Speaker, Storyboard } from '../domain.mjs';
import { StoryboardSchema } from '../schemas.mjs';
import { storyboardInputErrors } from './project-validation-inputs.mjs';

const PRESET_NAMES = new Set(['landscape', 'vertical', 'square', 'portrait']);
const SPEAKER_COLORS = new Set([
  'accent',
  'accent2',
  'ink',
  'positive',
  'negative',
]);
const nonnegative = (value: number | undefined) =>
  value == null || (Number.isFinite(value) && value >= 0);

function pacingErrors(sb: Storyboard): string[] {
  const errors: string[] = [];
  for (const key of [
    'lead',
    'tail',
    'minBeat',
    'silentBeat',
    'outro',
  ] as const) {
    if (!nonnegative(sb.pacing?.[key]))
      errors.push(`pacing.${key} must be nonnegative`);
  }
  return errors;
}

function speakerErrors(id: string, speaker: Speaker): string[] {
  const errors: string[] = [];
  if (!speaker.name.trim() || speaker.name.length > 40) {
    errors.push(`speakers.${id}.name must be text up to 40 characters`);
  }
  if (speaker.role != null && speaker.role.length > 40) {
    errors.push(`speakers.${id}.role must be text up to 40 characters`);
  }
  if (speaker.color != null && !SPEAKER_COLORS.has(speaker.color)) {
    errors.push(
      `speakers.${id}.color must be accent, accent2, ink, positive or negative`,
    );
  }
  return errors;
}

function beatErrors(beat: Beat, index: number, sb: Storyboard): string[] {
  const errors: string[] = [];
  const where = `beats[${index}]`;
  if (beat.scene && beat.block)
    errors.push(`${where} has both "scene" and "block" — use one`);
  if (beat.block && !/^[a-z0-9-]+$/.test(beat.block)) {
    errors.push(
      `${where}.block must be a block name like "stat" (see: clearframe blocks)`,
    );
  }
  if (beat.speaker != null && !sb.speakers?.[beat.speaker]) {
    errors.push(
      `${where}.speaker "${beat.speaker}" is not in storyboard.speakers`,
    );
  }
  if (
    beat.vo &&
    sb.voice?.cast &&
    (!beat.speaker || !sb.voice.cast[beat.speaker])
  ) {
    errors.push(`beats "${beat.id}" needs a speaker from voice.cast`);
  }
  return errors;
}

function assetErrors(asset: Asset, index: number): string[] {
  const errors: string[] = [];
  if (!['image', 'clip', 'sfx'].includes(asset.kind)) {
    errors.push(`assets[${index}].kind must be image | clip | sfx`);
  }
  if (asset.kind !== 'sfx' && !asset.file && !asset.prompt) {
    errors.push(`assets[${index}].prompt is required for kind "${asset.kind}"`);
  }
  return errors;
}

export function validateStoryboard(input: unknown): string[] {
  const errors = storyboardInputErrors(input);
  const decoded = Schema.decodeUnknownResult(StoryboardSchema)(input, {
    errors: 'all',
  });
  if (Result.isFailure(decoded)) return [...errors, decoded.failure.message];
  const sb = decoded.success;
  errors.push(...pacingErrors(sb));
  if (!sb.beats.length) errors.push('`beats` must be a non-empty array');
  if (!nonnegative(sb.budget)) errors.push('budget must be nonnegative');
  if (sb.format?.preset && !PRESET_NAMES.has(sb.format.preset))
    errors.push('Unknown format preset');
  const share = sb.continuity?.maxGeneratedShare;
  if (share != null && (!nonnegative(share) || share > 1))
    errors.push('maxGeneratedShare must be 0–1');
  for (const [id, speaker] of Object.entries(sb.speakers ?? {}))
    errors.push(...speakerErrors(id, speaker));
  sb.beats.forEach((beat, index) =>
    errors.push(...beatErrors(beat, index, sb)),
  );
  sb.assets?.forEach((asset, index) =>
    errors.push(...assetErrors(asset, index)),
  );
  return errors;
}
