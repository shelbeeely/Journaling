// Progressive extras for the guide. The page works without any of this.
(() => {
  // the contents list is open on a wide screen, closed on a phone
  const d = document.querySelector('.g-toc details');
  if (d && matchMedia('(min-width: 960px)').matches) d.open = true;
  // a copy button for every code block
  document.querySelectorAll('.g-code').forEach((box) => {
    const pre = box.querySelector('pre'), row = box.querySelector('.g-cl');
    if (!pre || !row || !navigator.clipboard) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'g-copy'; b.textContent = 'Copy';
    b.setAttribute('aria-label', 'Copy this code');
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, '')); b.textContent = 'Copied'; } catch { b.textContent = 'Press Ctrl+C'; }
      setTimeout(() => { b.textContent = 'Copy'; }, 1800);
    });
    row.append(b);
  });
})();
