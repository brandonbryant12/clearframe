import type {
  DiagramSpec,
  DiagramState,
  DiagramLayout,
  DiagramRoutes,
} from './contracts.mjs';
import { routePlans } from './route-plans.mjs';
import { assignPorts } from './route-ports.mjs';
import { assignChannels } from './route-channels.mjs';
import { routeLabels } from './route-labels.mjs';
export function diagramRoutes(
  input: DiagramSpec,
  state: DiagramState,
  layout: DiagramLayout,
): DiagramRoutes {
  const { routes, plans } = routePlans(state, layout);
  assignPorts(plans, layout);
  assignChannels(plans, routes, layout);
  return { routes, frames: routeLabels(input, state, layout, routes) };
}
