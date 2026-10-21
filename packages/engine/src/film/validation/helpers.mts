import type { BlockProps, PropHelpers, Fail, PropsItem } from '../types.mjs';

import { ICONS, iconAlias, iconHint } from '../icons.mjs';

export function helpers(
  p: BlockProps,
  fail: Fail,
  { findPhrase, precision }: Pick<PropHelpers, 'findPhrase' | 'precision'>,
): PropHelpers {
  const text = (v: unknown, field: string, max = 160): void => {
    if (v != null && (typeof v !== 'string' || v.length > max))
      fail(`${field} must be text up to ${max} characters`);
  };
  const num: PropHelpers['num'] = (n, key) => {
    if (!Number.isFinite(n)) fail(`${key} must be a finite number`);
  };
  const h: PropHelpers = {
    fail,
    text,
    num,
    findPhrase,
    precision,
    icon: (value, field) => {
      if (
        value != null &&
        (typeof value !== 'string' || !ICONS.includes(value))
      )
        fail(
          `${field}: ${iconHint(value)}${iconAlias(value) ? `: use "${iconAlias(value)}"` : ''}`,
        );
    },
    unit: (value, field) => {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1
      )
        fail(`${field} must be a number from 0 to 1`);
    },
    keys: (obj, allowed, field) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj))
        fail(`${field} must be an object`);
      for (const k of Object.keys(obj))
        if (!allowed.includes(k)) fail(`unsupported ${field}.${k}`);
    },
    list: (items, key, min, max) => {
      if (!Array.isArray(items) || items.length < min || items.length > max)
        fail(`${key} needs ${min}–${max} items`);
    },
    required: (v, key) => {
      if (typeof v !== 'string' || !v.trim()) fail(`${key} is required text`);
    },
    /** A counted figure: finite value (and from), decimals 0–8, short prefix/suffix. */
    numeric: (obj, key) => {
      num(obj.value, `${key}.value`);
      if (obj.from != null) num(obj.from, `${key}.from`);
      obj.decimals ??= precision(obj.value);
      if (
        !Number.isInteger(obj.decimals) ||
        obj.decimals < 0 ||
        obj.decimals > 8
      )
        fail(`${key}.decimals must be 0–8`);
      text(obj.prefix, `${key}.prefix`, 12);
      text(obj.suffix, `${key}.suffix`, 16);
    },
    /** Chart value format: {prefix, suffix, decimals} or a unit string; decimals default to the data's precision. */
    format: (values) => {
      if (typeof p.format === 'string') p.format = { suffix: p.format };
      p.format ??= {};
      if (!p.format || typeof p.format !== 'object' || Array.isArray(p.format))
        fail('format must be an object or unit string');
      for (const k of Object.keys(p.format))
        if (!['prefix', 'suffix', 'decimals'].includes(k))
          fail(`unsupported format.${k}`);
      if (
        p.format.decimals != null &&
        (!Number.isInteger(p.format.decimals) ||
          p.format.decimals < 0 ||
          p.format.decimals > 8)
      )
        fail('format.decimals must be 0–8');
      text(p.format.prefix, 'format.prefix', 12);
      text(p.format.suffix, 'format.suffix', 16);
      if (values)
        p.format.decimals ??= Math.max(...values.map((v) => precision(v)));
    },
  };
  return h;
}

export function sequence(
  allowed: readonly string[],
  required?: 'text' | 'title' | 'label' | 'detail',
): (p: BlockProps, h: PropHelpers) => PropsItem[] {
  return (p: BlockProps, h: PropHelpers) => {
    h.list(p.items, 'items', 2, 5);
    const items = p.items.map((it) =>
      typeof it === 'string' ? { text: it } : it,
    );
    items.forEach((it) => {
      h.keys(it, allowed, 'items');
      for (const k of ['text', 'title', 'label', 'detail'] as const)
        h.text(it[k], k, k === 'detail' ? 85 : 65);
    });
    p.items = items;
    if (required)
      items.forEach((d) => h.required(d[required], `items.${required}`));
    return items;
  };
}

export function nodes(
  key: 'nodes',
  min: number,
  max: number,
  allowed: readonly string[],
  { iconRequired = false, stagger = true } = {},
): (p: BlockProps, h: PropHelpers) => void {
  return (p: BlockProps, h: PropHelpers) => {
    h.list(p[key], key, min, max);
    p[key].forEach((it, i) => {
      h.keys(it, allowed, `${key}[${i}]`);
      h.text(it.label, 'label', 40);
      if (!it.label?.trim()) h.fail('every node needs a label');
      h.text(it.detail, 'detail', 70);
      if (
        (iconRequired || it.icon != null) &&
        (typeof it.icon !== 'string' || !ICONS.includes(it.icon))
      )
        h.fail(
          `${iconHint(it.icon)}${iconAlias(it.icon) ? `: use "${iconAlias(it.icon)}"` : ''}`,
        );
    });
    if (stagger) {
      p.stagger ??= 0.45;
      if (!Number.isFinite(p.stagger) || p.stagger < 0 || p.stagger > 2)
        h.fail('stagger must be 0–2 seconds');
    }
  };
}

export function media(
  p: BlockProps,
  h: PropHelpers,
  { plate }: { plate: boolean },
) {
  if (!p.asset && !p.file) h.fail('asset or file is required');
  if (p.offset != null && (!Number.isFinite(p.offset) || p.offset < 0))
    h.fail('offset must be nonnegative');
  if (plate) {
    if (p.fit != null && !['contain', 'cover'].includes(p.fit))
      h.fail('fit must be contain or cover');
    if (p.drift != null && typeof p.drift !== 'boolean')
      h.fail('drift must be true or false');
  }
}

export const headline = (p: BlockProps, h: PropHelpers) =>
  h.required(p.text ?? p.title, 'text/title');
