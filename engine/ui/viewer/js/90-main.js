// Keyboard and routing.
addEventListener('keydown', e => {
  if (e.key === 'Escape' && !sheetEl.hidden) return closeSheet();
  if (!pageKeys || !sheetEl.hidden || /input|textarea|select/i.test(document.activeElement?.tagName)) return;
  if (e.key === ' ' && pageKeys.toggle) { e.preventDefault(); pageKeys.toggle(); }
  if (e.key === 'ArrowRight' && pageKeys.nudge) pageKeys.nudge(e.shiftKey ? 5 : 1);
  if (e.key === 'ArrowLeft' && pageKeys.nudge) pageKeys.nudge(e.shiftKey ? -5 : -1);
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); pageKeys.note?.(); }
});

async function route() {
  closeSheet(); stopPage?.(); stopPage = null; homeCleanup?.(); lastLog = '';
  const [path, query] = location.hash.split('?'), [, page, a, b] = path.split('/');
  const start = Number(new URLSearchParams(query ?? '').get('t'));
  if (page === 'film') {
    // The film's notes and versions as they are now, not as they were when the page was built.
    await serverReady;
    if (server && data.films.find(x => x.id === a)?.kind === 'clearframe') { const fresh = await call(`/api/studio/film?film=${encodeURIComponent(a)}`).catch(() => null); const i = data.films.findIndex(x => x.id === a); if (fresh?.versions && i >= 0) data.films[i] = { ...data.films[i], ...fresh }; }
    filmPage(decodeURIComponent(a ?? ''), b && decodeURIComponent(b));
    const v = document.getElementById('video');
    if (v && start > 0) { const go = () => { v.currentTime = start; }; v.readyState ? go() : v.addEventListener('loadedmetadata', go, { once: true }); }
  } else home();
  scrollTo(0, 0);
}
addEventListener('hashchange', route);
route();
