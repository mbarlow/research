// Theme system — dark/light toggle + font switcher + localStorage

const FONT_PAIRS = [
  { id: 'IN', label: 'Inter', body: "'Inter', system-ui, -apple-system, sans-serif", mono: "'JetBrains Mono', monospace" },
  { id: 'IB', label: 'IBM Plex', body: "'IBM Plex Sans', system-ui, sans-serif", mono: "'IBM Plex Mono', monospace" },
  { id: 'LO', label: 'Lora', body: "'Lora', Georgia, serif", mono: "'Source Code Pro', monospace" },
];

let currentFontIndex = 0;

function applyFont(idx) {
  const pair = FONT_PAIRS[idx];
  document.documentElement.style.setProperty('--font-body', pair.body);
  document.documentElement.style.setProperty('--font-mono', pair.mono);
}

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('research-theme', theme);
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

export function cycleFont() {
  currentFontIndex = (currentFontIndex + 1) % FONT_PAIRS.length;
  applyFont(currentFontIndex);
  localStorage.setItem('research-font', currentFontIndex.toString());
  return FONT_PAIRS[currentFontIndex];
}

export function getCurrentFont() {
  return FONT_PAIRS[currentFontIndex];
}

export function initTheme() {
  const saved = localStorage.getItem('research-theme');
  if (saved) setTheme(saved);

  const savedFont = localStorage.getItem('research-font');
  if (savedFont) {
    currentFontIndex = parseInt(savedFont, 10) || 0;
  }
  applyFont(currentFontIndex);
}
