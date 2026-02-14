// Search overlay + client-side index

let postsData = [];
let isOpen = false;

export function setSearchData(data) {
  postsData = data;
}

export function toggleSearch() {
  isOpen = !isOpen;
  const overlay = document.getElementById('search-overlay');
  const input = document.getElementById('search-input');

  if (isOpen) {
    overlay.classList.remove('hidden');
    input.value = '';
    input.focus();
    document.getElementById('search-results').innerHTML = '';
  } else {
    overlay.classList.add('hidden');
  }
}

export function closeSearch() {
  if (!isOpen) return;
  isOpen = false;
  document.getElementById('search-overlay').classList.add('hidden');
}

export function isSearchOpen() {
  return isOpen;
}

function search(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return postsData.filter(post => {
    const title = (post.title || '').toLowerCase();
    const desc = (post.description || '').toLowerCase();
    const tags = Array.isArray(post.tags) ? post.tags.join(' ').toLowerCase() : '';
    const body = (post.body || '').toLowerCase();
    return title.includes(q) || desc.includes(q) || tags.includes(q) || body.includes(q);
  });
}

export function initSearch() {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const overlay = document.getElementById('search-overlay');

  input.addEventListener('input', () => {
    const matches = search(input.value);
    if (input.value.length < 2) {
      results.innerHTML = '<div class="search-hint">Type at least 2 characters...</div>';
      return;
    }
    if (matches.length === 0) {
      results.innerHTML = '<div class="search-empty">No results found</div>';
      return;
    }
    results.innerHTML = matches.map(post =>
      `<a href="#/post/${post.slug}" class="search-result" data-close-search>
        <div class="search-result-title">${post.title}</div>
        <div class="search-result-meta">${post.date}${post.tags ? ' · ' + (Array.isArray(post.tags) ? post.tags.join(', ') : post.tags) : ''}</div>
      </a>`
    ).join('');
  });

  // Close on click outside
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSearch();
  });

  // Close on result click
  results.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-search]')) closeSearch();
  });

  // Escape to close
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
    if (e.key === 'Enter') {
      const first = results.querySelector('.search-result');
      if (first) {
        first.click();
        closeSearch();
      }
    }
  });
}
