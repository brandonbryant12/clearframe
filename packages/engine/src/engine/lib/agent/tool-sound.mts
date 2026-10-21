import {
  soundState,
  type SoundTake,
  type SoundBeat,
  type SoundState,
} from '../viewer/sound.mjs';
import { startSound, requestSpend } from '../viewer/spend.mjs';
import type {
  ToolOptions,
  ToolHandlers,
  ToolInput,
  ToolResult,
} from './contracts.mjs';
import { fail } from './tool-common.mjs';

function spokenBy(beat: SoundBeat): string {
  if (beat.made === 'local')
    return `free draft voice (${beat.model ?? 'os-tts'}, ${beat.voice})`;
  if (beat.made)
    return `${beat.made} ${beat.model ?? ''} voice ${beat.voice}`.replace(
      /\s+/g,
      ' ',
    );
  return 'not made yet';
}
function takeDescription(take: SoundTake): string {
  const by = [...new Set(take.beats.map(spokenBy))];
  return `${by.join(' + ')}${take.status === 'google-changed' ? ', words changed since the Google take' : ''}${take.cost ? ` (Google take ≈$${take.cost.toFixed(3)} if approved)` : ''}`;
}
function narrationLines(narration: SoundState['narration']): string[] {
  if (narration.recorded)
    return [
      'Narration: the source recording (edit by cutting words; not regenerated).',
    ];
  const style = narration.style ? `, style "${narration.style}"` : '';
  return [
    `Narration as made (what the film plays now): ${narration.lines} lines in ${narration.takes.length} take(s): ${narration.takes.map((take) => `${take.id} ${takeDescription(take)}`).join('; ')}`,
    `Narration settings for Google (apply only to takes Google generates): voice ${narration.voice}${style}, model ${narration.model}. Never say a draft take used this voice or style.`,
  ];
}
function musicLine(music: SoundState['music']): string {
  if (music.off) return 'Music: off.';
  let made = 'none yet';
  if (music.made) {
    const provider =
      music.made === 'local'
        ? 'free draft bed (made on this computer)'
        : `${music.made} bed`;
    made = provider + (music.current ? ' (current)' : '');
  }
  return `Music as made: ${made}. Settings for Google: model ${music.model}; prompt "${music.prompt || 'derived from the edit'}"; level ${music.volume}${music.duck ? ', ducked under the voice' : ''}${music.cost ? `; Google bed ≈$${music.cost.toFixed(2)}` : ''}.`;
}
function status(dir: string, base: string): ToolResult {
  const sound = soundState(dir, base),
    narration = sound.narration,
    music = sound.music;
  const google = sound.providers.speech.find(
    (provider) => provider.id === 'google',
  );
  const provider = google?.ready
    ? "available (paid; needs the person's approval)"
    : `not configured — ${google?.needs ?? 'provider unavailable'}`;
  const narrationSummary = narration.recorded
    ? 'recorded narration'
    : `${narration.takes.length} take(s)`;
  const musicSummary = music.off ? 'off' : (music.made ?? 'none');
  return {
    content: [
      `Google sound: ${provider}`,
      ...narrationLines(narration),
      musicLine(music),
      'Change voice, style, music prompt, model and levels with clearframe_edit (film paths voice.voice, voice.style, music.prompt, music.model, music.volume, music.duck). Free drafts: action draft-voice / draft-music. Paid Google generation: action request with kind and reason.',
    ].join('\n'),
    metadata: { summary: `Sound: ${narrationSummary}, music ${musicSummary}` },
  };
}
function request(dir: string, input: ToolInput): ToolResult {
  if (!['voice', 'music'].includes(input.kind ?? ''))
    throw fail('Request narration (voice) or music.');
  if (typeof input.reason !== 'string' || !input.reason.trim())
    throw fail('Say why the person should pay for it.');
  const result = requestSpend(dir, input),
    kind = input.kind === 'voice' ? 'narration' : 'music';
  if (!result.id)
    return {
      content: result.note ?? 'Nothing to generate.',
      metadata: { summary: 'Already up to date', spend: null },
    };
  return {
    content: `Asked the person to approve about $${result.estimate.toFixed(3)} for Google ${kind} (${result.detail}). Nothing runs until they approve it in the studio; do not wait for it — continue or finish your reply.`,
    metadata: {
      summary: `Asked to approve ≈$${result.estimate.toFixed(3)} for Google ${kind}`,
      spend: result.id,
    },
  };
}
export function createSoundTools({
  base,
  jobs,
  filmOf,
}: ToolOptions): ToolHandlers {
  return {
    sound({ dir, input }) {
      const action = input.action ?? 'status';
      if (action === 'request') return request(dir, input);
      if (action === 'draft-voice' || action === 'draft-music') {
        const voice = action === 'draft-voice';
        const result = startSound(dir, filmOf(dir)?.id, jobs, {
          kind: voice ? 'voice' : 'music',
          paid: false,
        });
        return {
          content: `Queued the free ${voice ? 'draft narration' : 'draft music bed'} (job ${result.id}); follow it with clearframe_job.`,
          metadata: {
            summary: voice ? 'Free draft narration' : 'Free draft music bed',
            job: result.id,
          },
        };
      }
      return status(dir, base);
    },
  };
}
