import { orderBridgeTimes, bridgeSpec } from './bridge.mjs';
import { breakdownSettle } from './breakdown.mjs';

import type { BeatState } from './job-beat-contracts.mjs';

export function canvasBridge(state: BeatState): void {
  const { b, props, report } = state;
  // A bridge's last total is the payoff: one cued to the final word leaves nothing to read it in.
  if (b.props?.bridge != null) {
    // Each driver floats from the total before it, so columns must arrive in reading order.
    const spec = bridgeSpec(b.props.bridge, b.props.source),
      cued = [
        false,
        ...spec.steps.map((x) => x.say != null),
        spec.end?.say != null,
      ];
    const part = (kind: string, i: number) =>
      (props.elements ?? []).filter((e) =>
        new RegExp(`-bridge-${kind}-${i}(-\\d+)?$`).test(e.id ?? ''),
      );
    const times = cued.map((_, i) => part('bar', i)[0]?.at ?? 0),
      ordered = orderBridgeTimes(times, cued);
    ordered.forEach((t, i) => {
      for (const e of [
        ...part('bar', i),
        ...part('value', i),
        ...(i ? part('link', i - 1) : []),
      ])
        e.at = (e.at ?? 0) + t - times[i];
    });
    const landed = Math.max(
      ...(props.elements ?? [])
        .filter((e) => /-bridge-(bar|value|link)-\d+(-\d+)?$/.test(e.id ?? ''))
        .map((e) => (e.at ?? 0) + (e.dur ?? 0)),
    );
    state.settle = Math.max(state.settle, landed);
    if (b.dur - landed < 1.5)
      report.warnings.push(
        `${b.id}: the bridge's last total settles ${landed.toFixed(1)} s into a ${b.dur.toFixed(1)} s beat; cue it earlier or hold the beat (min) so it can be read.`,
      );
    if (landed > b.dur)
      throw new Error(
        `the bridge finishes at ${landed.toFixed(2)} s, after the beat ends; cue the drivers earlier or extend the beat.`,
      );
  }
  // A breakdown's last value is read after it lands, like a bridge's last total.
  if (b.props?.breakdown != null) {
    const landed = breakdownSettle(props.elements ?? []);
    state.settle = Math.max(state.settle, landed);
    if (b.dur - landed < 1.5)
      report.warnings.push(
        `${b.id}: the breakdown settles ${landed.toFixed(1)} s into a ${b.dur.toFixed(1)} s beat; cue its parts earlier or hold the beat so the last value can be read.`,
      );
  }
}
