import type { CanvasElement } from './types.mjs';
import type { AppPage, AppScene, AppPanelState } from './app-contracts.mjs';

import { appPanelHeading } from './app-panel-heading.mjs';
import { appPanelRows } from './app-panel-rows.mjs';
import { appPanelUpload } from './app-panel-upload.mjs';
import { appPanelFields } from './app-panel-fields.mjs';
import { appPanelButton } from './app-panel-button.mjs';
import { appPanelReceipt } from './app-panel-receipt.mjs';
export function appPanel(
  scene: AppScene,
  spec: AppPage,
  where: string,
  page: number,
): { panel: CanvasElement[]; bottom: number } {
  const state: AppPanelState = {
    scene,
    spec,
    where,
    page,
    panel: [],
    py: scene.cy + scene.pad,
    fx: scene.pad,
    fw: scene.inner,
    slot: null,
    bottom: 0,
  };
  appPanelHeading(state);
  appPanelRows(state);
  appPanelUpload(state);
  appPanelFields(state);
  appPanelButton(state);
  appPanelReceipt(state);
  return { panel: state.panel, bottom: state.bottom };
}
