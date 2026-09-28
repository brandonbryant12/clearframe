import fs from 'node:fs';
// Static, licensed geometry bundled with the renderer; never fetched while rendering.
const manifest = JSON.parse(fs.readFileSync(new URL('./assets/icons/tabler/manifest.json', import.meta.url), 'utf8'));
export const ICONS = manifest.files.filter(f => f.file.endsWith('.svg')).map(f => f.file.slice(0, -4));
export const ICON_SOURCE = { repository: manifest.repository, revision: manifest.revision, license: manifest.license };
