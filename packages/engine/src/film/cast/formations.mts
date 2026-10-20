import type {
  CastFormation,
  CastFrame,
  FormationOptions,
} from './contracts.mjs';
import { createLayout } from './formation-layout.mjs';
import { keepInFrame } from './formation-bounds.mjs';
import { scatter } from './formation-scatter.mjs';
import { row } from './formation-row.mjs';
import { ring } from './formation-ring.mjs';
import { cluster } from './formation-cluster.mjs';
import { hero } from './formation-hero.mjs';
import { swap } from './formation-swap.mjs';
import { exit } from './formation-exit.mjs';
export function formationTargets(
  f: CastFormation,
  ids: string[],
  frame: CastFrame,
  options: FormationOptions,
) {
  const layout = createLayout(f, ids, frame, options);
  switch (layout.form) {
    case 'scatter':
      scatter(layout);
      break;
    case 'row':
      row(layout);
      break;
    case 'ring':
      ring(layout);
      break;
    case 'cluster':
      cluster(layout);
      break;
    case 'hero':
      hero(layout);
      break;
    case 'swap':
      swap(layout);
      break;
    case 'exit':
      exit(layout);
      break;
    case 'column':
      row(layout);
      break;
  }
  keepInFrame(layout);
  return layout.out;
}
