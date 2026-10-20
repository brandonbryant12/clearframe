import type { AxisFormat } from './contracts.mjs';
import { utcDay } from './utc-day.mjs';

export function axisLabel(value: unknown, axis: AxisFormat): string {
  if (axis.type === 'date') {
    utcDay(value);
    // utcDay accepts only YYYY-MM-DD text.
    const date = String(value);
    if (axis.dateFormat === 'year') return date.slice(0, 4);
    if (axis.dateFormat === 'month')
      return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
    return date;
  }
  const amount = Number(value)
    .toFixed(axis.decimals ?? 0)
    .replace(/^-0(?=\.0+$|$)/, '0');
  return `${axis.prefix ?? ''}${amount}${axis.suffix ?? ''}`;
}
