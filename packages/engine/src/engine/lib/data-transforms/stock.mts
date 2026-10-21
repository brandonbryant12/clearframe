import { DATA_MODEL_VERSION } from './contracts.mjs';
import type { StockReconciliation } from './contracts.mjs';
import { object, number, components, sum } from './inputs.mjs';

/** Reconcile supplied signed changes to an independently observed closing value.
 * A nonzero residual is unexplained data, not automatically a transaction or valuation gain.
 */
export function reconcileStock(input: unknown): StockReconciliation {
  object(input, ['opening', 'closing', 'components'], 'reconciliation');
  const opening = number(input.opening, 'opening'),
    closing = number(input.closing, 'closing');
  const supplied = components(input.components, 'components'),
    suppliedNetChange = sum(supplied.map((p) => p.amount));
  const explainedClosing = sum([opening, suppliedNetChange]);
  const residual = number(closing - explainedClosing, 'unexplained residual');
  return {
    modelVersion: DATA_MODEL_VERSION,
    method: 'opening-plus-signed-changes-and-explicit-residual',
    opening,
    closing,
    netChange: number(closing - opening, 'net change'),
    suppliedNetChange,
    explainedClosing,
    residual,
    components: [
      ...supplied.map((p) => ({ ...p, kind: 'supplied' as const })),
      {
        id: 'residual',
        label: 'Unexplained',
        amount: residual,
        kind: 'residual',
      },
    ],
  };
}
