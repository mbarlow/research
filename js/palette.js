// Theme-aware palette for 3D scenes.
// Reads computed CSS variables, returns structured colors + Three.js helpers.

import * as THREE from 'three';

const VAR_MAP = {
  bg:             '--bg',
  surface:        '--bg-surface',
  elevated:       '--bg-elevated',
  border:         '--border',
  borderSubtle:   '--border-subtle',
  text:           '--text',
  textSecondary:  '--text-secondary',
  textMuted:      '--text-muted',
  accent:         '--accent',
  accentHover:    '--accent-hover',
  note:           '--callout-note',
  warning:        '--callout-warning',
  tip:            '--callout-tip',
  danger:         '--callout-danger',
};

function cssColorToRgb(str) {
  const ctx = cssColorToRgb._ctx ||=
    (() => { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.fillStyle = '#000'; return x; })();
  ctx.fillStyle = '#000';
  ctx.fillStyle = str;
  const m = ctx.fillStyle.match(/^#([0-9a-f]{6})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function rgbToHsl({ r, g, b }) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  if (s === 0) return { r: l, g: l, b: l };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return { r: hk(h + 1/3), g: hk(h), b: hk(h - 1/3) };
}

function toThree(rgb) { return new THREE.Color(rgb.r, rgb.g, rgb.b); }
function toHex(rgb)   { return (Math.round(rgb.r * 255) << 16) | (Math.round(rgb.g * 255) << 8) | Math.round(rgb.b * 255); }
function toCss(rgb)   { return `#${toHex(rgb).toString(16).padStart(6, '0')}`; }

function tint(rgb, amount) {
  const hsl = rgbToHsl(rgb);
  hsl.l = Math.max(0, Math.min(1, hsl.l + amount));
  return hslToRgb(hsl);
}

function rotateHue(rgb, degrees) {
  const hsl = rgbToHsl(rgb);
  hsl.h = (hsl.h + degrees / 360 + 1) % 1;
  return hslToRgb(hsl);
}

function buildHues(base, isDark) {
  // 6 harmonic colors spanning accent + callout family.
  // Hues rotate around the accent; saturation stays rich for data viz.
  const anchor = rgbToHsl(base.accent);
  const lum = isDark ? 0.58 : 0.46;
  const sat = Math.max(0.5, anchor.s);
  const make = (h) => hslToRgb({ h, s: sat, l: lum });
  return [
    base.accent,                                   // 0 — accent orange
    make((anchor.h + 330/360) % 1),                // 1 — warm red (brick)
    make((anchor.h + 80/360) % 1),                 // 2 — mustard / amber
    make((anchor.h + 150/360) % 1),                // 3 — forest green
    make((anchor.h + 200/360) % 1),                // 4 — teal
    make((anchor.h + 250/360) % 1),                // 5 — cool lavender
  ];
}

export function getPalette() {
  const cs = getComputedStyle(document.documentElement);
  const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';

  const raw = {};
  for (const [key, varName] of Object.entries(VAR_MAP)) {
    raw[key] = cssColorToRgb(cs.getPropertyValue(varName).trim());
  }

  const hues = buildHues(raw, isDark);

  const build = (fmt) => {
    const out = {};
    for (const k in raw) out[k] = fmt(raw[k]);
    out.hues = hues.map(fmt);
    return out;
  };

  return {
    isDark,
    ...raw,
    hues,
    hue: (i) => hues[((i % hues.length) + hues.length) % hues.length],
    shade: (rgb, amount) => tint(rgb, amount),
    rotate: (rgb, deg) => rotateHue(rgb, deg),
    as: {
      three: build(toThree),
      hex:   build(toHex),
      css:   build(toCss),
    },
  };
}

const listeners = new Set();

export function subscribePalette(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

let observer;
function ensureObserver() {
  if (observer) return;
  observer = new MutationObserver(() => {
    const palette = getPalette();
    for (const cb of listeners) {
      try { cb(palette); } catch (e) { console.warn('palette listener failed', e); }
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

if (typeof document !== 'undefined') ensureObserver();
