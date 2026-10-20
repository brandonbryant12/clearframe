import fs from 'node:fs';
import path from 'node:path';

export interface VeoModel {
  perSec: Readonly<Record<string, number>>;
  note: string;
}

export const MODELS = {
  'veo-3.1-lite-generate-preview': {
    perSec: { '720p': 0.05, '1080p': 0.08 },
    note: 'cheapest · no 4k · no reference images/extension',
  },
  'veo-3.1-fast-generate-preview': {
    perSec: { '720p': 0.1, '1080p': 0.12, '4k': 0.3 },
    note: 'fast',
  },
  'veo-3.1-generate-preview': {
    perSec: { '720p': 0.4, '1080p': 0.4, '4k': 0.6 },
    note: 'highest quality',
  },
} satisfies Readonly<Record<string, VeoModel>>;

export const modelLookup = new Map<string, VeoModel>(Object.entries(MODELS));

export const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
} satisfies Readonly<Record<string, string>>;

export const mimeLookup = new Map(Object.entries(MIME));

export interface InlineImage {
  inlineData: { mimeType: string; data: string };
}

export const inline = (file: string): InlineImage => ({
  inlineData: {
    mimeType: mimeLookup.get(path.extname(file).toLowerCase()) ?? 'image/png',
    data: fs.readFileSync(file).toString('base64'),
  },
});

export interface VeoRequestOptions {
  prompt?: string | undefined;
  model?: string | undefined;
  image?: string | undefined;
  lastFrame?: string | undefined;
  aspect?: string | undefined;
  resolution?: string | undefined;
  seconds?: number | string | undefined;
  seed?: number | string | undefined;
  personGeneration?: string | undefined;
}

export interface VeoInstance {
  prompt: string;
  image?: InlineImage;
  lastFrame?: InlineImage;
}

export interface VeoParameters {
  aspectRatio: string;
  resolution: string;
  durationSeconds: number;
  seed?: number;
  personGeneration?: string;
}

export interface VeoRequest {
  instances: VeoInstance[];
  parameters: VeoParameters;
}

export function buildRequest({
  prompt,
  model = 'veo-3.1-lite-generate-preview',
  image,
  lastFrame,
  aspect = '16:9',
  resolution = '720p',
  seconds = 4,
  seed,
  personGeneration,
}: VeoRequestOptions): VeoRequest {
  if (!prompt?.trim()) throw new Error('prompt is required');
  if (!['16:9', '9:16'].includes(aspect))
    throw new Error('aspect must be 16:9 or 9:16');
  if (![4, 6, 8].includes(+seconds))
    throw new Error('seconds must be 4, 6 or 8');
  if (resolution !== '720p' && +seconds !== 8)
    throw new Error(`${resolution} requires seconds=8`);
  if (resolution === '4k' && model.includes('lite'))
    throw new Error('Veo 3.1 Lite does not support 4k');
  if (lastFrame && !image) throw new Error('lastFrame requires image');
  const instance: VeoInstance = { prompt };
  if (image) instance.image = inline(image);
  if (lastFrame) instance.lastFrame = inline(lastFrame);
  const parameters: VeoParameters = {
    aspectRatio: aspect,
    resolution,
    durationSeconds: +seconds,
  };
  if (seed != null) parameters.seed = +seed;
  if (personGeneration) parameters.personGeneration = personGeneration;
  return { instances: [instance], parameters };
}

export function estimateCost({
  model = 'veo-3.1-lite-generate-preview',
  resolution = '720p',
  seconds = 4,
}: {
  model?: string | undefined;
  resolution?: string | undefined;
  seconds?: number | undefined;
}): number {
  return (modelLookup.get(model)?.perSec?.[resolution] ?? 0.4) * seconds;
}

/** A request body for printing: inline frames are replaced by a marker. */
export function printable(body: VeoRequest): VeoRequest {
  const [instance] = body.instances;
  const hide = (img: InlineImage | undefined) =>
    img ? { inlineData: { ...img.inlineData, data: '<base64>' } } : undefined;
  const image = hide(instance.image),
    lastFrame = hide(instance.lastFrame);
  return {
    ...body,
    instances: [
      {
        ...instance,
        ...(image ? { image } : {}),
        ...(lastFrame ? { lastFrame } : {}),
      },
    ],
  };
}
