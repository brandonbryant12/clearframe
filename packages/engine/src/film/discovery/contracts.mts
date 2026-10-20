import type { JsonRecord, LibraryItems, LibraryKind } from '../types.mjs';
export interface DiscoveryEntry {
  id: string;
  kind: string;
  name: string;
  title: string;
  about: string;
  when: string;
  needs: string;
  ref: string;
}
export interface DiscoveryExample {
  block?: string;
  props?: JsonRecord;
  beats?: DiscoveryExample[];
  note?: string;
}
export interface DiscoveryDetail extends Omit<DiscoveryEntry, 'kind' | 'name'> {
  props?: string[];
  example?: DiscoveryExample;
  note?: string;
  scenes?: string[];
  use?: string;
  names?: readonly string[];
  item?: LibraryItems[LibraryKind];
}
export interface DiscoveryOptions {
  limit?: number;
  kinds?: string[] | null;
  perKind?: number;
}
export type MechanismEntry = [
  string,
  string,
  string,
  string,
  string,
  DiscoveryExample | null,
];
export interface CastExamples {
  [move: string]: DiscoveryExample;
}
export interface SearchSynonyms {
  [word: string]: string;
}
