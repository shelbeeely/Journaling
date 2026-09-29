// Theme toggle only. The page works without it (it follows the system light/dark setting).
(() => {
  const root = document.documentElement, btn = document.getElementById('theme');
  const dark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  try { const t = localStorage.getItem('jw-theme'); if (t) root.dataset.theme = t; } catch {}
  const sync = () => btn && btn.setAttribute('aria-pressed', String(dark()));
  sync();
  btn && btn.addEventListener('click', () => {
    root.dataset.theme = dark() ? 'light' : 'dark';
    try { localStorage.setItem('jw-theme', root.dataset.theme); } catch {}
    sync();
  });
})();
