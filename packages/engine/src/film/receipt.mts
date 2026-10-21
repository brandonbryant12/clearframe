import type { CanvasElement, Fail } from './types.mjs';
import type { ReceiptInput } from './receipt-contracts.mjs';

export type { ReceiptInput, ReceiptItem } from './receipt-contracts.mjs';
export { RECEIPT_FIELDS } from './receipt-common.mjs';
import { receiptSetup } from './receipt-setup.mjs';
import { receiptHeader } from './receipt-header.mjs';
import { receiptSlip } from './receipt-slip.mjs';
import { receiptItems } from './receipt-items.mjs';
import { receiptTotal } from './receipt-total.mjs';
import { receiptPaper } from './receipt-paper.mjs';
import { receiptMarks } from './receipt-marks.mjs';
import { receiptSmall } from './receipt-small.mjs';
import { receiptFinish } from './receipt-finish.mjs';
export function expandReceipt(
  input: ReceiptInput,
  at: string,
  fail: Fail,
): CanvasElement {
  const scene = receiptSetup(input, at, fail);
  receiptHeader(scene);
  if (scene.slip) receiptSlip(scene);
  else receiptItems(scene);
  receiptTotal(scene);
  const paper = receiptPaper(scene);
  receiptMarks(scene);
  receiptSmall(scene);
  return receiptFinish(scene, paper);
}
