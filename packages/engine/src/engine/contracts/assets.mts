export interface Speaker {
  name: string;
  role?: string;
  color?: string;
  stem?: string;
}

export interface Source {
  id?: string;
  title?: string;
  url?: string;
  file?: string;
  note?: string;
  publisher?: string;
  date?: string;
  quote?: string;
}

export interface Asset {
  id: string;
  kind: string;
  file?: string;
  prompt?: string;
  model?: string;
  provider?: string;
  duration?: number;
  width?: number;
  height?: number;
  aspectRatio?: string;
  layers?: boolean | string[];
  cutout?: boolean;
  subject?: string;
  treatment?: string;
  bounds?: {
    box: [number, number, number, number];
    size: [number, number];
  } | null;
  foreground?: string;
  reference?: string;
  references?: string[];
  refs?: string[];
  image?: string;
  from?: string;
  seconds?: number;
  aspect?: string;
  resolution?: string;
  previousInteractionId?: string;
  seed?: number;
  raw?: boolean;
  size?: string;
  ground?: string;
  style?: string;
}
