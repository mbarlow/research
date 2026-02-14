// Theme system — dark/light toggle + font switcher + localStorage

const MONO_FONTS = [
  { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { name: 'Fira Code', value: "'Fira Code', monospace" },
  { name: 'Source Code Pro', value: "'Source Code Pro', monospace" },
];

let currentFontIndex = 0;

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
  currentFontIndex = (currentFontIndex + 1) % MONO_FONTS.length;
  const font = MONO_FONTS[currentFontIndex];
  document.documentElement.style.setProperty('--font-mono', font.value);
  localStorage.setItem('research-font', currentFontIndex.toString());
  return font.name;
}

export function getCurrentFont() {
  return MONO_FONTS[currentFontIndex].name;
}

export function initTheme() {
  const saved = localStorage.getItem('research-theme');
  if (saved) setTheme(saved);

  const savedFont = localStorage.getItem('research-font');
  if (savedFont) {
    currentFontIndex = parseInt(savedFont, 10) || 0;
    document.documentElement.style.setProperty('--font-mono', MONO_FONTS[currentFontIndex].value);
  }
}
