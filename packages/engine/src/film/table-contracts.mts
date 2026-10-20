import type { Timed } from './types.mjs';
export interface TableColumn {
  id: string;
  label: string;
  align: 'left' | 'right';
  weight: number;
}
export interface TableRow {
  id: string;
  cells: Record<string, string>;
}
export interface TableView {
  id: string;
  label: string;
  hide: string[];
}
export interface TableShow extends Timed {
  view: string;
}
export interface TableSpec {
  id: string;
  title: string;
  source: string;
  asOf?: string;
  columns: TableColumn[];
  rows: TableRow[];
  views: TableView[];
  show: TableShow[];
}
export interface TableInput {
  id?: string;
  title: string;
  source: string;
  asOf?: string;
  columns: Array<
    Omit<TableColumn, 'align' | 'weight'> & {
      align?: 'left' | 'right';
      weight?: number;
    }
  >;
  rows: TableRow[];
  views?: Array<Omit<TableView, 'hide'> & { hide?: string[] }>;
  show?: TableShow[];
}
export interface TableInterval {
  at: number;
  view: TableView;
}
export interface TableColumnPosition extends TableColumn {
  x: number;
  w: number;
}
