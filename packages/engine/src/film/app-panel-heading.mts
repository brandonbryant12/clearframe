import type { AppPanelState } from './app-contracts.mjs';

export function appPanelHeading(state: AppPanelState): void {
  const { scene, spec, where, panel, py } = state;
  const { s, pad, text, fail } = scene;
  const { heading } = spec;

  if (heading != null) {
    if (typeof heading !== 'string' || heading.length > 32)
      fail(`${where}.heading must be the panel's title, up to 32 characters`);
    panel.push(text(heading, pad, py + s * 1.15, s * 1.4, 'strong', 'ink'));
    state.py += s * 1.4 + s * 1.0;
  }
}
