import type { Fields } from '../fields.mjs';

import type { EventKind, StageBuild } from '../stage-kit.mjs';

export interface EventInput {
  kind: EventKind;
  ev: Fields;
  where: string;
  /** Layer seconds the event is cued at, and the optional end of what it shows. */
  t: number;
  until: number | null;
  id: string;
}

export type Handler = (build: StageBuild, input: EventInput) => void;
