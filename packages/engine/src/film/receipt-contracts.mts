import type { ElementFields } from './types.mjs';
import type { receiptSetup } from './receipt-setup.mjs';
/** One printed line of a receipt. */
export interface ReceiptItem {
  qty?: number;
  name: string;
  price: number;
}
/** A receipt element as authored (checked here as it expands). */
export interface ReceiptInput extends ElementFields {
  merchant?: string;
  detail?: string;
  items?: ReceiptItem[];
  tax?: number;
  tip?: number;
  total?: number;
  paid?: string;
  footer?: string;
  slip?: boolean;
  lines?: string[];
  currency?: string;
}

export type ReceiptScene = ReturnType<typeof receiptSetup>;
