import fs from 'node:fs';
// Static, licensed geometry bundled with the renderer; never fetched while rendering.
const manifest = JSON.parse(fs.readFileSync(new URL('./assets/icons/tabler/manifest.json', import.meta.url), 'utf8'));
export const ICONS = manifest.files.filter(f => f.file.endsWith('.svg')).map(f => f.file.slice(0, -4));
export const ICON_SOURCE = { repository: manifest.repository, revision: manifest.revision, license: manifest.license };

// Names agents reach for that the bundled set calls something else.
const ALIASES = {
  x: 'close', cross: 'close', cancel: 'close', 'circle-x': 'close', warning: 'alert', 'alert-triangle': 'alert', danger: 'alert',
  dollar: 'cash', money: 'cash', 'currency-dollar': 'cash', email: 'mail', envelope: 'mail', person: 'user', people: 'users',
  bin: 'trash', delete: 'trash', garbage: 'trash', 'trash-can': 'trash', 'trash-2': 'trash',
  document: 'file', doc: 'file', 'file-text': 'file', time: 'clock', padlock: 'lock', tick: 'check', ok: 'check',
  'circle-check': 'check', savings: 'piggy-bank', 'building-bank': 'bank', house: 'home', idea: 'lightbulb', cart: 'shopping-cart',
  graph: 'chart-line', chart: 'chart-bar', smartphone: 'phone', mobile: 'phone', computer: 'laptop', 'id-badge': 'badge',
  health: 'first-aid', medical: 'stethoscope', doctor: 'stethoscope', 'shield-check': 'shield', send: 'forward',
};
/** The bundled icon a name means: itself, or the icon a common other name stands for (x → close). */
export const iconAlias = name => (ICONS.includes(name) ? name : (ALIASES[name] ?? null));
/** "unknown icon NAME" with the nearest bundled names. */
export function iconHint(name) {
  const d = (a, b) => {
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  };
  const score = n => Math.min(d(String(name), n), n.includes(String(name)) || String(name).includes(n) ? 1 : 99);
  const near = [...ICONS.map(n => [n, score(n)]), ...Object.entries(ALIASES).map(([a, n]) => [n, score(a)])]
    .sort((a, b) => a[1] - b[1])
    .filter(([, k]) => k <= 3)
    .map(([n]) => n)
    .filter((n, i, all) => all.indexOf(n) === i)
    .slice(0, 4);
  return `unknown icon ${name}${near.length ? `; nearest: ${near.join(', ')}` : ''} (clearframe icons lists all ${ICONS.length})`;
}
