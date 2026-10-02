// Regenerate illustrative output from its exact retained inputs. No network or rendering.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as finance from '../../engine/lib/finance.mjs';
const inputFile = new URL('./inputs.json', import.meta.url);
const bytes = fs.readFileSync(inputFile);
const input = JSON.parse(bytes);
const allowed = ['matchingContribution', 'vestedBalance', 'salaryServiceBenefit', 'accountLedger', 'feeComparison'];
const cases = Object.fromEntries(Object.entries(input.cases).map(([id, spec]) => {
  if (!allowed.includes(spec.operation)) throw new Error(`Unknown specimen operation: ${spec.operation}`);
  return [id, finance[spec.operation](spec.input)];
}));
const result = { modelVersion: finance.FINANCE_MODEL_VERSION, disclosure: input.disclosure,
  asOf: input.asOf, currency: input.currency,
  inputSha256: crypto.createHash('sha256').update(bytes).digest('hex'), cases };
fs.writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(`Prepared ${Object.keys(cases).length} illustrative calculation cases; no visual output.`);
