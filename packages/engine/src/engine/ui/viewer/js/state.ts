import type { PageKeys } from './30-film.js';
interface BrowserState {
  stopPage: (() => void) | null;
  pageKeys: PageKeys | null;
  lastLog: string;
}
export const browserState: BrowserState = {
  stopPage: null,
  pageKeys: null,
  lastLog: '',
};
