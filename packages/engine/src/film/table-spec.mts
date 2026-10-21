import { utcDay } from './plot-data.mjs';
import { check, own, label, ID } from './table-common.mjs';
import { decodeTable } from './table-schema.mjs';
import type { TableSpec } from './table-contracts.mjs';
export function tableSpec(input: unknown): TableSpec {
  own(
    input,
    ['id', 'title', 'source', 'asOf', 'columns', 'rows', 'views', 'show'],
    'table',
  );
  const decoded = decodeTable(input);
  const p: TableSpec = {
    ...decoded,
    id: decoded.id ?? 'table',
    columns: decoded.columns.map((c) => ({
      ...c,
      align: c.align ?? 'left',
      weight: c.weight ?? 1,
    })),
    views: (decoded.views ?? [{ id: 'all', label: 'All records' }]).map(
      (v) => ({ ...v, hide: v.hide ?? [] }),
    ),
    show: decoded.show ?? [],
  };
  check(
    typeof p.id === 'string' && ID.test(p.id),
    'id is a short lowercase name',
  );
  label(p.title, 'title', 70);
  label(p.source, 'source', 110);
  if (p.asOf != null) utcDay(p.asOf);
  const cols = columns(p);
  rows(p, cols);
  const views = audienceViews(p, cols);
  changes(p, views);
  return p;
}

function columns(p: TableSpec) {
  check(
    Array.isArray(p.columns) && p.columns.length >= 1 && p.columns.length <= 6,
    'use 1–6 columns',
  );
  const cols = new Set<string>();
  for (const c of p.columns) {
    own(c, ['id', 'label', 'align', 'weight'], 'column');
    check(
      typeof c.id === 'string' && ID.test(c.id) && !cols.has(c.id),
      'column ids must be unique short lowercase names',
    );
    cols.add(c.id);
    label(c.label, `column ${c.id} label`, 32);
    c.align ??= 'left';
    c.weight ??= 1;
    check(
      ['left', 'right'].includes(c.align),
      `column ${c.id} align must be left or right`,
    );
    check(
      Number.isFinite(c.weight) && c.weight >= 0.5 && c.weight <= 4,
      `column ${c.id} weight must be between 0.5 and 4`,
    );
  }
  return cols;
}

function rows(p: TableSpec, cols: Set<string>) {
  check(
    Array.isArray(p.rows) && p.rows.length >= 1 && p.rows.length <= 8,
    'use 1–8 rows; split longer tables into shots',
  );
  const rows = new Set<string>();
  for (const r of p.rows) {
    own(r, ['id', 'cells'], 'row');
    check(
      typeof r.id === 'string' && ID.test(r.id) && !rows.has(r.id),
      'row ids must be unique short lowercase names',
    );
    rows.add(r.id);
    own(r.cells, [...cols], `row ${r.id} cells`);
    for (const c of p.columns)
      label(
        r.cells[c.id],
        `row ${r.id}, column ${c.id} (format numbers with their units)`,
      );
  }
}

function audienceViews(p: TableSpec, cols: Set<string>) {
  if (p.views == null)
    p.views = [{ id: 'all', label: 'All records', hide: [] }];
  check(
    Array.isArray(p.views) && p.views.length >= 1 && p.views.length <= 6,
    'views needs 1–6 audience views',
  );
  const views = new Set<string>();
  for (const v of p.views) {
    own(v, ['id', 'label', 'hide'], 'view');
    check(
      typeof v.id === 'string' && ID.test(v.id) && !views.has(v.id),
      'view ids must be unique short lowercase names',
    );
    views.add(v.id);
    label(v.label, `view ${v.id} label`, 60);
    v.hide ??= [];
    check(
      Array.isArray(v.hide) &&
        new Set(v.hide).size === v.hide.length &&
        v.hide.every((c) => cols.has(c)),
      `view ${v.id} hide must name unique columns`,
    );
  }
  return views;
}

function changes(p: TableSpec, views: Set<string>) {
  p.show ??= [];
  check(
    Array.isArray(p.show) && p.show.length <= 12,
    'show takes at most 12 audience changes',
  );
  for (const s of p.show) {
    own(s, ['view', 'at', 'say', 'cue', 'after'], 'show');
    check(views.has(s.view), `show names unknown view ${s.view}`);
    check(
      (['at', 'say', 'cue'] as const).filter((k) => s[k] != null).length === 1,
      'each show needs exactly one of at, say or cue',
    );
    if (s.at != null)
      check(
        Number.isFinite(s.at) && s.at >= 0,
        'show.at must be nonnegative scene seconds',
      );
    for (const k of ['say', 'cue'] as const)
      if (s[k] != null) label(s[k], `show.${k}`);
    check(
      s.after == null ||
        (Number.isFinite(s.after) && (s.say != null || s.cue != null)),
      'show.after needs a word or named cue',
    );
  }
}
