import type { AppInput } from './app-contracts.mjs';
import type { CanvasElement, Fail, FrameSize } from './types.mjs';
export type {
  AppInput,
  AppRow,
  AppUpload,
  AppField,
  AppButton,
  AppPage,
} from './app-contracts.mjs';
export { APP_FIELDS } from './app-common.mjs';
import { appSetup } from './app-setup.mjs';
import { appHeader } from './app-header.mjs';
import { appPages } from './app-pages.mjs';
import { appFinish } from './app-finish.mjs';
export function expandApp(
  input: AppInput,
  at: string,
  fail: Fail,
  canvas?: FrameSize,
): CanvasElement {
  const scene = appSetup(input, at, fail, canvas);
  appHeader(scene);
  return appFinish(scene, appPages(scene));
}
