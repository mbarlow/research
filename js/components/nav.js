// Top navigation bar
import { toggleTheme, getTheme, cycleFont, getCurrentFont } from '../theme.js';
import { toggleSearch } from '../search.js';

export function initNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = `
    <div class="nav-inner">
      <a href="#/" class="nav-title">Research</a>
      <div class="nav-actions">
        <button id="btn-search" class="nav-btn" title="Search (/)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <button id="btn-font" class="nav-btn" title="Cycle font (f)">
          <span class="nav-font-label">JB</span>
        </button>
        <button id="btn-theme" class="nav-btn" title="Toggle theme (t)">
          <svg id="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg id="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
        <a href="#/tags" class="nav-btn" title="All tags">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        </a>
      </div>
    </div>
  `;

  document.getElementById('btn-theme').addEventListener('click', () => {
    toggleTheme();
    updateThemeIcon();
  });

  document.getElementById('btn-font').addEventListener('click', () => {
    const name = cycleFont();
    updateFontLabel(name);
  });

  document.getElementById('btn-search').addEventListener('click', toggleSearch);

  updateThemeIcon();
  updateFontLabel(getCurrentFont());
}

export function updateThemeIcon() {
  const isDark = getTheme() === 'dark';
  document.getElementById('icon-sun').style.display = isDark ? 'none' : 'block';
  document.getElementById('icon-moon').style.display = isDark ? 'block' : 'none';
}

function updateFontLabel(name) {
  const labels = { 'JetBrains Mono': 'JB', 'Fira Code': 'FC', 'Source Code Pro': 'SC' };
  const label = document.querySelector('.nav-font-label');
  if (label) label.textContent = labels[name] || 'JB';
}
