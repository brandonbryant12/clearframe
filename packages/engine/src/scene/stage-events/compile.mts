import { fail, fieldsOf, optString } from '../fields.mjs';

import { EVENTS, cueOrNull, isEvent } from '../stage-kit.mjs';
import type { EventKind, StageBuild } from '../stage-kit.mjs';
import type { Handler } from './contracts.mjs';
import { send } from './send.mjs';
import {
  pulse,
  state,
  move,
  show,
  hide,
  connect,
  disconnect,
} from './actors.mjs';
import { callout } from './callout.mjs';
import { burst, camera } from './effects.mjs';

export const HANDLERS: Readonly<Record<EventKind, Handler>> = {
  send,
  pulse,
  highlight: pulse,
  state,
  move,
  show,
  hide,
  callout,
  burst,
  connect,
  disconnect,
  camera,
};

/** Compile `events` in authored order; each is cued inside the stage. */
export function compileEvents(
  build: StageBuild,
  events: readonly unknown[],
): void {
  for (const [i, raw] of events.entries()) {
    const where = `${build.where}.events[${i}]`;
    const ev = fieldsOf(raw);
    const kind = ev.do;
    if (!isEvent(kind)) return fail(where, `do is ${EVENTS.join(', ')}`);
    const t = cueOrNull(build, ev.say ?? ev.at);
    if (t == null) return fail(where, 'needs at or say');
    if (t >= build.end)
      fail(
        where,
        `is cued at ${t.toFixed(2)} s, after the stage ends (${build.end.toFixed(2)} s)`,
      );
    const until =
      ev.untilSay != null || ev.until != null
        ? cueOrNull(build, ev.untilSay ?? ev.until)
        : null;
    const id = optString(ev.id, where, 'id') ?? `${kind}-${++build.count}`;
    HANDLERS[kind](build, { kind, ev, where, t, until, id });
  }
}
