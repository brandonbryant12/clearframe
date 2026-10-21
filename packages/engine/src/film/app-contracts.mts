import type { ReceiptInput } from './receipt.mjs';
import type { ElementFields, CanvasElement } from './types.mjs';
import type { appSetup } from './app-setup.mjs';
/** When a part of the screen happens: a spoken word (and seconds after it) or seconds. */
export interface Cued {
  say?: string;
  at?: number;
  after?: number;
}
export interface AppRow extends Cued {
  label: string;
  badge?: string;
  tone?: string;
}
export interface AppUpload extends Cued {
  label: string;
  receipt?: ReceiptInput;
}
export interface AppField extends Cued {
  label: string;
  value?: string;
  id?: string;
}
export interface AppButton extends Cued {
  label: string;
  done?: string;
}
export interface AppPage extends Cued {
  heading?: string;
  rows?: Array<string | AppRow>;
  upload?: AppUpload;
  fields?: AppField[];
  button?: AppButton;
}
/** An app element as authored (checked here as it expands). */
export interface AppInput extends ElementFields {
  device?: string;
  tabs?: string[];
  heading?: string;
  open?: Cued;
  upload?: AppUpload;
  fields?: AppField[];
  button?: AppButton;
  pages?: AppPage[];
}
/** A part's time: on its word (and `after` it), or at its seconds. */
export type When =
  | { say: string; after: number; at?: undefined }
  | { at: number; say?: undefined; after?: undefined };
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AppScene = ReturnType<typeof appSetup>;
export interface AppPanelState {
  scene: AppScene;
  spec: AppPage;
  where: string;
  page: number;
  panel: CanvasElement[];
  py: number;
  fx: number;
  fw: number;
  slot: Box | null;
  bottom: number;
}
