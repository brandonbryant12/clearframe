// The three depth layers of a plate set, the prompts that draw them, and the asset expansion.

export type PlateLayer = 'far' | 'mid' | 'near';
export const PLATE_LAYERS: readonly PlateLayer[] = ['far', 'mid', 'near'];
const isPlateLayer = (k: string): k is PlateLayer =>
  k === 'far' || k === 'mid' || k === 'near';

/** A cut-out subject's alpha bounding box as fractions of the image, and the image size in pixels. */
export interface AlphaBounds {
  box: [number, number, number, number];
  size: [number, number];
}

/** What a layer's prompt is written from: the scene, and optionally its subject and foreground. */
export interface LayerBrief {
  prompt?: string | undefined;
  subject?: string | undefined;
  foreground?: string | undefined;
}
export interface LayerSpec {
  z: number;
  cutout: boolean;
  prompt: (a: LayerBrief) => string;
}

// Cut-out layers describe objects, never scenes: asked for a scene "on green", image models
// paint a framed picture of the scene on green. So the mid layer draws the `subject` alone
// and the near layer only the `foreground` entering from the edges.
export const LAYERS: Readonly<Record<PlateLayer, LayerSpec>> = {
  far: {
    z: 6,
    cutout: false,
    prompt: (a) =>
      `${a.prompt}. A wide background painting of the whole setting, no figures close to the camera; other layers will stand in front of it.`,
  },
  mid: {
    z: 1.2,
    cutout: true,
    prompt: (a) =>
      `${a.subject ?? `The main subject of this setting: ${a.prompt}`}. Draw only this subject as one isolated object with clean natural edges: no outline, no white border, no scenery, no sky, no ground plane, no water, no frame or picture-in-picture. Whole and uncropped, centred, with empty green all around it.`,
  },
  near: {
    z: -0.35,
    cutout: true,
    prompt: (a) =>
      `${a.foreground ?? `Foreground framing that suits this setting: ${a.prompt}`}: large, very close to the camera, entering only from the left and right edges of the image. Nothing else: no sky, no landscape, no horizon, no light or colour on the background. The whole centre of the image is empty green: no picture, frame, window or scene in it.`,
  },
};
/** Each layer's depth on the stage's z axis. */
export const LAYER_DEPTH: Readonly<Record<PlateLayer, number>> = {
  far: LAYERS.far.z,
  mid: LAYERS.mid.z,
  near: LAYERS.near.z,
};

export const CHROMA =
  'Isolated on a perfectly flat, uniform pure green (#00FF00) background, like a studio green screen: no shadow, gradient, floor or reflection on the background, crisp clean edges, and nothing green in the subject itself.';

/** A storyboard asset as plate expansion reads it. `layers: true` is all three. */
export interface LayeredAsset {
  id: string;
  kind: string;
  prompt?: string | undefined;
  subject?: string | undefined;
  foreground?: string | undefined;
  layers?: boolean | readonly string[] | undefined;
}
/** One generated layer of a plate set: `ID-far`, `ID-mid` or `ID-near`. */
export type PlateLayerAsset<A extends LayeredAsset> = Omit<
  A,
  'id' | 'kind' | 'prompt' | 'subject' | 'foreground' | 'layers'
> & {
  id: string;
  kind: 'image';
  prompt: string;
  cutout?: true;
  plate: { of: string; layer: PlateLayer };
};

function layerNames(layers: LayeredAsset['layers']): readonly PlateLayer[] {
  if (layers === true) return PLATE_LAYERS;
  return (layers || []).map((k) => {
    if (!isPlateLayer(k))
      throw new Error(`Unknown plate layer "${k}": use far, mid or near.`);
    return k;
  });
}

/** Assets with `layers: true` become three generated assets: `ID-far`, `ID-mid`, `ID-near`. */
export function expandAssets<A extends LayeredAsset>(
  assets: readonly A[] = [],
): (A | PlateLayerAsset<A>)[] {
  return assets.flatMap((a): (A | PlateLayerAsset<A>)[] => {
    if (a.kind !== 'image' || !a.layers) return [a];
    const pick = layerNames(a.layers);
    const {
      layers: _layers,
      kind: _kind,
      id,
      prompt,
      subject,
      foreground,
      ...rest
    } = a;
    return pick.map((k) => ({
      ...rest,
      id: `${id}-${k}`,
      kind: 'image' as const,
      prompt: LAYERS[k].prompt({ prompt, subject, foreground }),
      ...(LAYERS[k].cutout ? { cutout: true as const } : {}),
      plate: { of: id, layer: k },
    }));
  });
}
