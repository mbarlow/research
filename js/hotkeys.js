// Configurable keyboard shortcuts

import { toggleTheme } from './theme.js';
import { toggleSearch, closeSearch, isSearchOpen } from './search.js';
import { navigate } from './router.js';

const bindings = [
  { key: '/', label: 'Toggle search', action: toggleSearch },
  { key: 't', label: 'Toggle dark/light', action: toggleTheme },
  { key: 'f', label: 'Cycle font', action: () => {
    import('./theme.js').then(m => m.cycleFont());
  }},
  { key: 'h', label: 'Go home', action: () => navigate('#/') },
  { key: 'Escape', label: 'Close overlays', action: () => {
    closeSearch();
    document.getElementById('hotkey-overlay').classList.add('hidden');
    document.getElementById('lightbox').classList.add('hidden');
  }},
  { key: '?', label: 'Show shortcuts', action: toggleHotkeyHelp },
  { key: 'ArrowLeft', label: 'Previous post', action: () => navigatePost(-1) },
  { key: 'ArrowRight', label: 'Next post', action: () => navigatePost(1) },
];

let postsData = [];

export function setHotkeyPosts(data) {
  postsData = data;
}

function navigatePost(direction) {
  const hash = window.location.hash || '#/';
  const match = hash.match(/^#\/post\/(.+)$/);
  if (!match) return;
  const slug = match[1];
  const idx = postsData.findIndex(p => p.slug === slug);
  if (idx === -1) return;
  const next = postsData[idx + direction];
  if (next) navigate(`#/post/${next.slug}`);
}

function toggleHotkeyHelp() {
  const overlay = document.getElementById('hotkey-overlay');
  overlay.classList.toggle('hidden');
}

export function initHotkeys() {
  // Render help
  const list = document.getElementById('hotkey-list');
  list.innerHTML = bindings.map(b =>
    `<div class="hotkey-row">
      <kbd>${b.key === ' ' ? 'Space' : b.key}</kbd>
      <span>${b.label}</span>
    </div>`
  ).join('');

  document.addEventListener('keydown', (e) => {
    // Skip when typing in input/textarea
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
      // Only handle Escape in inputs
      if (e.key === 'Escape') {
        closeSearch();
        return;
      }
      return;
    }

    // Don't fire hotkeys with modifier keys (except shift for ?)
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const binding = bindings.find(b => b.key === e.key);
    if (binding) {
      e.preventDefault();
      binding.action();
    }
  });

  // Close hotkey overlay on click outside
  document.getElementById('hotkey-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'hotkey-overlay') toggleHotkeyHelp();
  });
}
