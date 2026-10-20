import type { AppScene } from './app-contracts.mjs';
import { when } from './app-common.mjs';
import { appPanel } from './app-panel.mjs';
export function appPages(scene: AppScene): number {
  const {
    pages,
    at,
    fail,
    input,
    heading,
    upload,
    fields,
    button,
    height,
    els,
    open,
  } = scene;
  let h: number;
  if (pages != null) {
    // Pages: each takes over the screen on its word, sliding in as an app's next screen does.
    if (!Array.isArray(pages) || pages.length < 2 || pages.length > 5)
      fail(
        `${at}.pages must be 2–5 pages: {heading, rows | upload, fields, button, say|at}`,
      );
    for (const key of [
      'heading',
      'open',
      'upload',
      'fields',
      'button',
    ] as const)
      if (input[key] != null)
        fail(`${at}.${key} belongs to a page when the app has pages`);
    const built = pages.map((p, k) => {
      if (!p || typeof p !== 'object') fail(`${at}.pages[${k}] must be a page`);
      for (const key of Object.keys(p))
        if (
          ![
            'heading',
            'rows',
            'upload',
            'fields',
            'button',
            'say',
            'at',
            'after',
          ].includes(key)
        )
          fail(`${at}.pages[${k}]: unsupported field ${key}`);
      if (k > 0 && !when(p))
        fail(`${at}.pages[${k}] needs say (the word it opens on) or at`);
      return appPanel(scene, p, `${at}.pages[${k}]`, k);
    });
    h = Math.max(...built.map((b) => b.bottom), height ?? 0);
    built.forEach(({ panel }, k) => {
      // The page that is leaving clears quickly as the next one slides in a moment later, so
      // the two screens' words never sit on top of each other.
      const opens =
        k > 0
          ? { ...when(pages[k], 0.2), enter: 'right', dist: 72, dur: 0.35 }
          : {};
      const next = pages[k + 1] && when(pages[k + 1]);
      const leaves = next
        ? {
            ...(next.say != null
              ? { exitSay: next.say, exitAfter: next.after }
              : { exitAt: next.at }),
            exit: 'fade',
            exitDur: 0.15,
          }
        : {};
      els.push({ type: 'group', ...opens, ...leaves, children: panel });
    });
  } else {
    const { panel, bottom } = appPanel(
      scene,
      { heading, upload, fields, button },
      at,
      0,
    );
    h = Math.max(bottom, height ?? 0);
    const opened = when(open);
    if (open != null && !opened)
      fail(`${at}.open must be {say|at}: the word the panel opens on`);
    els.push(
      opened
        ? { type: 'group', ...opened, enter: 'rise', dist: 24, children: panel }
        : { type: 'group', children: panel },
    );
  }
  return h;
}
