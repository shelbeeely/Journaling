// Docs index: search and filters. The full list is in the HTML, so without JavaScript it is simply a list.
(() => {
  const form = document.getElementById('filters'), list = document.getElementById('list');
  if (!form || !list) return;
  form.hidden = false;
  const q = document.getElementById('q'), cat = document.getElementById('cat'), ev = document.getElementById('ev');
  const count = document.getElementById('count'), empty = document.getElementById('empty');
  const cards = [...list.children];
  const params = new URLSearchParams(location.search);
  q.value = params.get('q') || ''; cat.value = params.get('category') || ''; ev.value = params.get('evidence') || '';
  if (cat.value !== (params.get('category') || '')) cat.value = '';
  if (ev.value !== (params.get('evidence') || '')) ev.value = '';
  function apply(push) {
    const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    let n = 0;
    for (const c of cards) {
      const ok = (!cat.value || c.dataset.category === cat.value) && (!ev.value || c.dataset.evidence === ev.value) && words.every((w) => c.dataset.search.includes(w));
      c.hidden = !ok; if (ok) n++;
    }
    count.textContent = n === cards.length ? `Showing all ${n} docs.` : `Showing ${n} of ${cards.length} docs.`;
    empty.hidden = n !== 0;
    if (push) {
      const p = new URLSearchParams();
      if (q.value) p.set('q', q.value); if (cat.value) p.set('category', cat.value); if (ev.value) p.set('evidence', ev.value);
      try { history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname); } catch {}
    }
  }
  form.addEventListener('input', () => apply(true));
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('reset', () => setTimeout(() => apply(true)));
  apply(false);
})();
