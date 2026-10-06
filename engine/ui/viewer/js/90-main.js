// Keyboard shortcuts and hash routing.
addEventListener('keydown', e => {
  if (e.key === 'Escape' && !box.hidden) return close();
  const v = document.getElementById('video');
  if (!v || !box.hidden || /input|textarea|select/i.test(document.activeElement?.tagName)) return;
  if (e.key === ' ' || e.key === 'k') { e.preventDefault(); v.paused ? v.play() : v.pause(); }
  if (e.key === 'ArrowRight') v.currentTime += e.shiftKey ? 5 : 1;
  if (e.key === 'ArrowLeft') v.currentTime -= e.shiftKey ? 5 : 1;
  if (e.key === 'l' || e.key === 'L') workspaceKeys?.lens();
  if (e.key === 'n' || e.key === 'N') workspaceKeys?.note();
  if (e.key === ',' || e.key === '.') workspaceKeys?.step(e.key === '.' ? 1 : -1);
  if (e.key === 'o' || e.key === 'O') workspaceKeys?.loop();
});

function route() {
  close(); stopLoop?.(); stopLoop = null; studioCleanup?.(); studioCleanup = null;
  document.body.classList.remove('home'); homeCleanup?.();
  const [path, query] = location.hash.split('?'), [, page, a, b, c] = path.split('/');
  const start = Number(new URLSearchParams(query ?? '').get('t'));
  if (page === 'film') {
    if (!b && data.films.find(f => f.id === a)?.kind === 'clearframe') { studio(a); return; }
    film(a, b, c);
    if (start > 0) { const v = document.getElementById('video'); const go = () => { v.currentTime = start; }; v.readyState ? go() : v.addEventListener('loadedmetadata', go, { once: true }); }
  } else if (page === 'compare') compare(a);
  else if (page === 'library') library(a, b);
  else films();
  scrollTo(0, 0);
}
addEventListener('hashchange', route);
route();
