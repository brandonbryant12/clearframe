import type { CanvasElement } from './types.mjs';
import type { DiagramOptions } from './diagram/contracts.mjs';
import { decodeDiagram } from './diagram/schema.mjs';
import { check, object, DIAGRAM_LIMITS } from './diagram/shared.mjs';
import { diagramState } from './diagram/state.mjs';
import { diagramLayout } from './diagram/layout.mjs';
import { diagramRoutes } from './diagram/routes.mjs';
import { diagramDrawing } from './diagram/elements.mjs';
export { DIAGRAM_LIMITS } from './diagram/shared.mjs';

/** Compile stable component identities, lifetimes, and connections to native canvas elements. */
export function diagramElements(
  value: unknown,
  { width = 1920, height = 1080, resolve }: DiagramOptions = {},
): CanvasElement[] {
  object(
    value,
    ['nodes', 'edges', 'steps', 'groups', 'direction', 'area'],
    'diagram',
  );
  const input = decodeDiagram(value);
  const L = DIAGRAM_LIMITS;
  check(
    input.nodes.length >= 1 && input.nodes.length <= L.nodes,
    `use 1–${L.nodes} nodes per shot; split larger systems into shots`,
  );
  check(
    (input.edges?.length ?? 0) <= L.edges,
    `use at most ${L.edges} edges per shot`,
  );
  check(
    (input.steps?.length ?? 0) <= L.steps,
    `use at most ${L.steps} steps per shot`,
  );
  check(
    (input.groups?.length ?? 0) <= L.groups,
    `use at most ${L.groups} groups per shot`,
  );
  const state = diagramState(input, resolve);
  const layout = diagramLayout(input, state, width, height);
  return diagramDrawing(state, layout, diagramRoutes(input, state, layout));
}
