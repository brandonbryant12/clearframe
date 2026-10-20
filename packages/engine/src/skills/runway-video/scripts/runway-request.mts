export interface RunwayModel {
  credits: Readonly<Record<string, number>>;
  minimum: number;
  seconds: readonly [number, number];
  lastFrame: boolean;
  audio: boolean;
  note: string;
}

// Credits per second of output (1 credit = $0.01), from docs.dev.runwayml.com/guides/pricing.md on 2026-10-04.
export const MODELS = {
  seedance2_5: {
    credits: { '480p': 20, '720p': 30, '1080p': 68 },
    minimum: 80,
    seconds: [4, 15],
    lastFrame: true,
    audio: true,
    note: 'strongest motion and keyframe control; first/last frames',
  },
  seedance2: {
    credits: { '720p': 36, '1080p': 40 },
    minimum: 0,
    seconds: [4, 15],
    lastFrame: true,
    audio: true,
    note: 'previous Seedance',
  },
  seedance2_fast: {
    credits: { '720p': 29 },
    minimum: 0,
    seconds: [4, 15],
    lastFrame: true,
    audio: true,
    note: 'faster Seedance draft',
  },
  'gen4.5': {
    credits: { '720p': 12 },
    minimum: 0,
    seconds: [2, 10],
    lastFrame: false,
    audio: false,
    note: 'cheapest; first frame only',
  },
} satisfies Readonly<Record<string, RunwayModel>>;

export const modelLookup = new Map<string, RunwayModel>(Object.entries(MODELS));

export const RATIOS = {
  '480p': { '16:9': '854:480', '9:16': '480:854' },
  '720p': { '16:9': '1280:720', '9:16': '720:1280', '1:1': '960:960' },
  '1080p': { '16:9': '1920:1080', '9:16': '1080:1920', '1:1': '1440:1440' },
} satisfies Readonly<Record<string, Readonly<Record<string, string>>>>;

export const ratioLookup = new Map<string, Readonly<Record<string, string>>>(
  Object.entries(RATIOS),
);

export function ratioFor(
  model: string,
  aspect: string,
  resolution: string,
): string {
  const r = ratioLookup.get(resolution)?.[aspect];
  if (!r) throw new Error(`No ${resolution} ${aspect} ratio`);
  if (model === 'gen4.5' && !['1280:720', '720:1280', '960:960'].includes(r))
    throw new Error('gen4.5 supports 720p only');
  return r;
}

export interface RunwayRequestOptions {
  prompt?: string | undefined;
  model?: string | undefined;
  images?: readonly string[] | undefined;
  aspect?: string | undefined;
  resolution?: string | undefined;
  seconds?: number | string | undefined;
  seed?: number | string | undefined;
  audio?: boolean | undefined;
}

export interface RunwayBody {
  model: string;
  promptText: string;
  ratio: string;
  duration: number;
  promptImage?: { uri: string; position: 'first' | 'last' }[];
  seed?: number;
  audio?: boolean;
}

/** A request's choices after defaults, as the model's limits are checked against them. */
export interface RequestChoices {
  resolution: string;
  seconds: number | string;
  aspect: string;
  images: readonly string[];
}

export function checkRequest(
  model: string,
  m: RunwayModel,
  prompt: string,
  o: RequestChoices,
): void {
  if (model === 'gen4.5' && prompt.length > 1000)
    throw new Error('gen4.5 prompts are limited to 1000 characters');
  if (!((m.credits[o.resolution] ?? 0) > 0))
    throw new Error(`${model} has no ${o.resolution} output`);
  if (
    !Number.isInteger(+o.seconds) ||
    +o.seconds < m.seconds[0] ||
    +o.seconds > m.seconds[1]
  )
    throw new Error(
      `${model} needs ${m.seconds[0]}–${m.seconds[1]} whole seconds`,
    );
  if (o.images.length > 2)
    throw new Error('at most two keyframes: first and last');
  if (o.images.length === 2 && !m.lastFrame)
    throw new Error(`${model} accepts a first frame only`);
  if (model === 'gen4.5' && !o.images.length && o.aspect === '1:1')
    throw new Error('gen4.5 text-to-video is 16:9 or 9:16');
}

/** The JSON body for one request. `images` are already-resolved URIs: [first] or [first, last]. */
export function buildRequest({
  prompt,
  model = 'seedance2_5',
  images = [],
  aspect = '16:9',
  resolution = '720p',
  seconds = 5,
  seed,
  audio = false,
}: RunwayRequestOptions): { endpoint: string; body: RunwayBody } {
  const m = modelLookup.get(model);
  if (!m) throw new Error(`Unsupported Runway model ${model}`);
  if (!prompt?.trim()) throw new Error('prompt is required');
  checkRequest(model, m, prompt, { resolution, seconds, aspect, images });
  const body: RunwayBody = {
    model,
    promptText: prompt,
    ratio: ratioFor(model, aspect, resolution),
    duration: +seconds,
  };
  if (images.length)
    body.promptImage = images.map((uri, i) => ({
      uri,
      position: i ? 'last' : 'first',
    }));
  if (seed != null) body.seed = +seed;
  // Clip audio is never mixed into a ClearFrame film; skip generating it where the model allows.
  if (m.audio) body.audio = !!audio;
  return {
    endpoint: images.length ? '/v1/image_to_video' : '/v1/text_to_video',
    body,
  };
}

export function estimateCost({
  model = 'seedance2_5',
  resolution = '720p',
  seconds = 5,
}: {
  model?: string | undefined;
  resolution?: string | undefined;
  seconds?: number | undefined;
}): number {
  const m = modelLookup.get(model);
  return (
    Math.max(m?.minimum ?? 0, (m?.credits?.[resolution] ?? 40) * seconds) / 100
  );
}
