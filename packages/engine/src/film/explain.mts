// Formula-driven and seeded explanation primitives compiled to native canvas elements.
import { graphElements } from './explanation/graph.mjs';
import { accumulateElements } from './explanation/accumulate.mjs';
import { estimateElements } from './explanation/estimate.mjs';
import { fieldElements } from './explanation/field.mjs';
export { FUNCTIONS } from './explanation/shared.mjs';
export { FIELDS } from './explanation/field.mjs';
export { graphElements, accumulateElements, estimateElements, fieldElements };
export const EXPLAIN = {
  graph: graphElements,
  accumulate: accumulateElements,
  estimate: estimateElements,
  field: fieldElements,
};
