// Sidebar table of contents — scroll-aware highlighting

let activeObserver = null;

export function renderToc(headings) {
  const sidebar = document.getElementById('toc-sidebar');
  if (!headings || headings.length === 0) {
    sidebar.innerHTML = '';
    return;
  }

  const html = headings.map(h => {
    const indent = h.level - 2;
    return `<button type="button" class="toc-link toc-level-${h.level}" data-target-id="${h.id}" style="padding-left: ${indent * 12 + 8}px">${h.text}</button>`;
  }).join('');

  sidebar.innerHTML = `<div class="toc-content"><div class="toc-label">On this page</div>${html}</div>`;

  // In SPA hash routing, avoid heading hashes and scroll manually instead.
  sidebar.querySelectorAll('.toc-link').forEach(link => {
    link.addEventListener('click', () => {
      const id = link.getAttribute('data-target-id');
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height').trim(), 10) || 56;
      const top = window.scrollY + target.getBoundingClientRect().top - navHeight - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  });

  // Scroll-aware highlighting
  if (activeObserver) activeObserver.disconnect();

  const links = sidebar.querySelectorAll('.toc-link');
  const targets = headings.map(h => document.getElementById(h.id)).filter(Boolean);

  activeObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const link = sidebar.querySelector(`.toc-link[data-target-id="${entry.target.id}"]`);
        if (link) link.classList.add('active');
      }
    }
  }, {
    rootMargin: '-80px 0px -70% 0px',
    threshold: 0,
  });

  targets.forEach(t => activeObserver.observe(t));
}

export function clearToc() {
  document.getElementById('toc-sidebar').innerHTML = '';
  if (activeObserver) {
    activeObserver.disconnect();
    activeObserver = null;
  }
}
