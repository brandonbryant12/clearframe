import { type Relation } from '../../distribution-data.mjs';

export function qualifiesThreshold(
  relation: Relation,
  threshold: number,
  value: number,
): boolean {
  switch (relation) {
    case 'gte':
      return value >= threshold;
    case 'gt':
      return value > threshold;
    case 'lte':
      return value <= threshold;
    case 'lt':
      return value < threshold;
  }
}
