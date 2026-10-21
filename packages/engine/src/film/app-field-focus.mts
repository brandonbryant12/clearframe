import type { AppPanelState, When } from './app-contracts.mjs';
import { round, when } from './app-common.mjs';
export function appFieldFocus(
  state: AppPanelState,
  typed: When,
  i: number,
  top: number,
): void {
  const { panel, fx, fw } = state;
  const { s, fieldH } = state.scene;
  const { fields = [] } = state.spec;
  // The field takes focus as its value types in, as an app's does, and lets it go after (or
  // as the next field takes it, when that one types on the same word or clock).

  const next =
    fields
      .slice(i + 1)
      .map((g) => g.value != null && when(g))
      .find(Boolean) || null;
  const same =
    next != null &&
    (typed.say != null ? next.say === typed.say : next.at != null);
  const typedAt = typed.say != null ? typed.after : typed.at;
  let nextAt = 0;
  if (next != null) nextAt = next.say != null ? next.after : next.at;
  const until = same ? Math.min(typedAt + 1.1, nextAt - 0.02) : typedAt + 1.1;
  panel.push({
    type: 'rect',
    x: round(fx),
    y: round(top + s * 1.4),
    w: round(fw),
    h: fieldH,
    r: 14,
    fill: 'none',
    stroke: 'accent',
    width: 4,
    ...(typed.say != null
      ? { say: typed.say, after: Math.max(0, typed.after - 0.1) }
      : { at: Math.max(0, typed.at - 0.1) }),
    enter: 'fade',
    dur: 0.12,
    exit: 'fade',
    exitDur: same ? 0.12 : 0.35,
    ...(typed.say != null
      ? { exitSay: typed.say, exitAfter: round(until * 100) / 100 }
      : { exitAt: round(until * 100) / 100 }),
  });
}
