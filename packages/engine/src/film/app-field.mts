import type { AppPanelState, AppField } from './app-contracts.mjs';
import { slug, round, when } from './app-common.mjs';
import { appFieldFocus } from './app-field-focus.mjs';
export function appField(
  state: AppPanelState,
  f: AppField,
  i: number,
  baseY: number,
): void {
  const { scene, where, page, panel, fx, fw } = state;
  const { s, id, text, label, fieldH, uid, fail } = scene;
  const at2 = `${where}.fields[${i}]`;
  checkField(f, at2, fail);
  const fid = f.id ?? uid(`${id}-field-${slug(f.label)}`, page);
  const top = baseY + i * (fieldH + s * 1.9);
  panel.push(label(f.label, fx, top + s * 0.9));
  panel.push({
    type: 'rect',
    id: fid,
    x: round(fx),
    y: round(top + s * 1.4),
    w: round(fw),
    h: fieldH,
    r: 14,
    fill: 'bg',
    stroke: 'line',
    width: 2,
  });
  if (f.value != null) {
    const typed = when(f);
    if (f.value.length * s * 0.6 > fw - s * 1.6)
      fail(
        `${at2}.value "${f.value}" is too long for the field: shorten it or widen the app (w)`,
      );
    if (typed) appFieldFocus(state, typed, i, top);
    panel.push(
      text(
        f.value,
        fx + s * 0.8,
        top + s * 1.4 + fieldH * 0.66,
        s * 1.15,
        'strong',
        'ink',
        typed ? { ...typed, enter: 'type', dur: 0.45 } : {},
      ),
    );
  }
}
function checkField(
  f: AppField,
  at2: string,
  fail: (message: string) => never,
): void {
  if (
    !f ||
    typeof f !== 'object' ||
    typeof f.label !== 'string' ||
    !f.label.trim() ||
    f.label.length > 24
  )
    fail(`${at2}.label must be the field's name, up to 24 characters`);
  if (f.value != null && (typeof f.value !== 'string' || f.value.length > 24))
    fail(`${at2}.value must be what it holds, up to 24 characters`);
  for (const key of Object.keys(f))
    if (!['label', 'value', 'say', 'at', 'after', 'id'].includes(key))
      fail(`${at2}: unsupported field ${key}`);
}
