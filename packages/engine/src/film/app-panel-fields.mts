import { appField } from './app-field.mjs';

import type { AppPanelState } from './app-contracts.mjs';

export function appPanelFields(state: AppPanelState): void {
  const { scene, spec, where, py, slot } = state;
  const { s, phone, fieldH, fail } = scene;
  const { fields = [] } = spec;
  if (!Array.isArray(fields) || fields.length > 4)
    fail(`${where}.fields must be up to four {label, value, say|at}`);
  // An upload slot (the slot exists exactly when the panel has an upload) sits beside the fields in a window.
  const beside = slot != null && !phone ? slot : null;
  fields.forEach((f, i) => appField(state, f, i, beside ? beside.y : py));
  const fieldsEnd =
    (beside ? beside.y : py) + fields.length * (fieldH + s * 1.9);
  state.py = Math.max(
    fieldsEnd,
    beside ? beside.y + beside.h + s * 2.2 : 0,
    py,
  );
}
