// Tiny WFC running in the nav logo slot.
// 6x6 grid of solid-color tiles. Builds, holds, fades out via a randomly
// chosen pattern, then rebuilds.

const GRID = 6;

const TILE_SPECS = [
  { edges: [0, 0, 0, 0], kind: 'grass' },
  { edges: [0, 1, 0, 1], kind: 'road' },
  { edges: [1, 0, 1, 0], kind: 'road' },
  { edges: [1, 1, 1, 1], kind: 'junction' },
  { edges: [1, 0, 0, 1], kind: 'road' },
  { edges: [1, 1, 0, 0], kind: 'road' },
  { edges: [0, 0, 1, 1], kind: 'road' },
  { edges: [0, 1, 1, 0], kind: 'road' },
  { edges: [2, 2, 2, 2], kind: 'water' },
  { edges: [0, 0, 2, 0], kind: 'shore' },
  { edges: [2, 0, 0, 0], kind: 'shore' },
  { edges: [0, 2, 0, 0], kind: 'shore' },
  { edges: [0, 0, 0, 2], kind: 'shore' },
];

function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
  return {
    grass:    v('--text-muted',       '#6e6859'),
    road:     v('--accent',           '#e8541c'),
    junction: v('--accent-hover',     '#ff6b30'),
    water:    v('--text-secondary',   '#a89e87'),
    shore:    v('--callout-warning',  '#d2a25a'),
    elevated: v('--bg-elevated',      '#1a1a1a'),
  };
}

const opposite = [2, 3, 0, 1];
function canPlace(a, dir, b) {
  return TILE_SPECS[a].edges[dir] === TILE_SPECS[b].edges[opposite[dir]];
}

// Fade-out patterns: each returns a delay (0..1) for cell at (x, y).
// Same delay = simultaneous; spread of delays = staggered animation.
const PATTERNS = [
  // Pure random
  () => {
    const order = [];
    for (let i = 0; i < GRID * GRID; i++) order.push(i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [order[i], order[j]] = [order[j], order[i]];
    }
    const delays = new Array(GRID * GRID);
    order.forEach((idx, rank) => { delays[idx] = rank / (GRID * GRID - 1); });
    return delays;
  },
  // Spiral inward
  () => {
    const delays = new Array(GRID * GRID);
    const visited = new Array(GRID * GRID).fill(false);
    let x = 0, y = 0, dir = 0; // 0=right,1=down,2=left,3=up
    const dxs = [1, 0, -1, 0], dys = [0, 1, 0, -1];
    let rank = 0;
    while (rank < GRID * GRID) {
      delays[y * GRID + x] = rank / (GRID * GRID - 1);
      visited[y * GRID + x] = true;
      rank++;
      const nx = x + dxs[dir], ny = y + dys[dir];
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID || visited[ny * GRID + nx]) {
        dir = (dir + 1) % 4;
      }
      x += dxs[dir]; y += dys[dir];
    }
    return delays;
  },
  // Diagonal sweep (top-left to bottom-right)
  () => {
    const delays = new Array(GRID * GRID);
    const maxRank = (GRID - 1) * 2;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        delays[y * GRID + x] = (x + y) / maxRank;
      }
    }
    return delays;
  },
  // Center outward
  () => {
    const delays = new Array(GRID * GRID);
    const cx = (GRID - 1) / 2, cy = (GRID - 1) / 2;
    const maxD = Math.hypot(cx, cy);
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        delays[y * GRID + x] = Math.hypot(x - cx, y - cy) / maxD;
      }
    }
    return delays;
  },
  // Edges inward
  () => {
    const delays = new Array(GRID * GRID);
    const cx = (GRID - 1) / 2, cy = (GRID - 1) / 2;
    const maxD = Math.hypot(cx, cy);
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        delays[y * GRID + x] = 1 - Math.hypot(x - cx, y - cy) / maxD;
      }
    }
    return delays;
  },
  // Row-by-row wipe
  () => {
    const delays = new Array(GRID * GRID);
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        delays[y * GRID + x] = y / (GRID - 1);
      }
    }
    return delays;
  },
];

export function initWfcLogo(canvas, sizePx) {
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width = sizePx * dpr;
  canvas.height = sizePx * dpr;
  canvas.style.width = sizePx + 'px';
  canvas.style.height = sizePx + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;

  const cell = sizePx / GRID;
  const gap = Math.max(0.5, cell * 0.18);
  const inner = cell - gap;

  // Timing
  const STEPS_PER_SEC = 22;     // WFC collapses per second
  const HOLD_MS = 900;          // pause after build completes
  const FADE_DURATION = 700;    // total fade-out time
  const FADE_PER_CELL = 280;    // each cell's individual fade window

  let palette = readPalette();
  let grid, collapsed;
  let phase;        // 'building' | 'holding' | 'fading'
  let phaseStart;   // performance.now() when phase began
  let stepAccumMs;  // accumulator for WFC stepping
  let fadeDelays;   // per-cell delay 0..1 for current fade pattern

  function newBuild() {
    grid = [];
    collapsed = [];
    for (let i = 0; i < GRID * GRID; i++) {
      const all = new Set();
      for (let t = 0; t < TILE_SPECS.length; t++) all.add(t);
      grid.push(all);
      collapsed.push(-1);
    }
    palette = readPalette();
    phase = 'building';
    phaseStart = performance.now();
    stepAccumMs = 0;
  }

  function findLowestEntropy() {
    let min = Infinity;
    let cands = [];
    for (let i = 0; i < GRID * GRID; i++) {
      if (collapsed[i] >= 0) continue;
      const e = grid[i].size;
      if (e === 0) return -2;
      if (e < min) { min = e; cands = [i]; }
      else if (e === min) cands.push(i);
    }
    if (cands.length === 0) return -1;
    return cands[(Math.random() * cands.length) | 0];
  }

  function collapseCell(ci) {
    const opts = [...grid[ci]];
    if (opts.length === 0) return false;
    const weights = opts.map(t => (t === 0 ? 3 : t === 8 ? 2 : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let chosen = opts[0];
    for (let i = 0; i < opts.length; i++) {
      r -= weights[i];
      if (r <= 0) { chosen = opts[i]; break; }
    }
    collapsed[ci] = chosen;
    grid[ci] = new Set([chosen]);
    return true;
  }

  function propagate(start) {
    const stack = [start];
    const dirs = [
      { dx: 0, dy: -1, dir: 0 },
      { dx: 1, dy: 0,  dir: 1 },
      { dx: 0, dy: 1,  dir: 2 },
      { dx: -1, dy: 0, dir: 3 },
    ];
    while (stack.length) {
      const ci = stack.pop();
      const cx = ci % GRID;
      const cy = (ci / GRID) | 0;
      for (const { dx, dy, dir } of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
        const ni = ny * GRID + nx;
        if (collapsed[ni] >= 0) continue;
        const before = grid[ni].size;
        const valid = new Set();
        for (const a of grid[ci]) for (const b of grid[ni]) {
          if (canPlace(a, dir, b)) valid.add(b);
        }
        if (valid.size < before) {
          grid[ni] = valid;
          if (valid.size > 0) stack.push(ni);
        }
      }
    }
  }

  function stepWFC() {
    const ci = findLowestEntropy();
    if (ci === -1) return 'done';
    if (ci === -2) return 'contradiction';
    if (!collapseCell(ci)) return 'contradiction';
    propagate(ci);
    return 'ok';
  }

  function colorFor(i) {
    if (collapsed[i] < 0) return palette.elevated;
    return palette[TILE_SPECS[collapsed[i]].kind];
  }

  // Draw a cell at given scale (0..1) and alpha (0..1).
  function drawCell(x, y, color, scale, alpha) {
    if (scale <= 0 || alpha <= 0) return;
    const w = inner * scale;
    const px = x * cell + cell / 2 - w / 2;
    const py = y * cell + cell / 2 - w / 2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(px, py, w, w);
  }

  function draw() {
    ctx.clearRect(0, 0, sizePx, sizePx);
    if (phase === 'fading') {
      const elapsed = performance.now() - phaseStart;
      const span = FADE_DURATION - FADE_PER_CELL;
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          const i = y * GRID + x;
          const startMs = fadeDelays[i] * span;
          const localT = Math.max(0, Math.min(1, (elapsed - startMs) / FADE_PER_CELL));
          const k = 1 - localT; // remaining
          drawCell(x, y, colorFor(i), k, k);
        }
      }
      ctx.globalAlpha = 1;
    } else {
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          const i = y * GRID + x;
          drawCell(x, y, colorFor(i), 1, 1);
        }
      }
    }
  }

  let lastFrame = performance.now();
  let raf = 0;
  let alive = true;

  function frame() {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = now - lastFrame;
    lastFrame = now;

    if (phase === 'building') {
      stepAccumMs += dt;
      const stepMs = 1000 / STEPS_PER_SEC;
      while (stepAccumMs >= stepMs) {
        stepAccumMs -= stepMs;
        const r = stepWFC();
        if (r === 'done') {
          phase = 'holding';
          phaseStart = now;
          break;
        }
        if (r === 'contradiction') {
          newBuild();
          break;
        }
      }
    } else if (phase === 'holding') {
      if (now - phaseStart >= HOLD_MS) {
        phase = 'fading';
        phaseStart = now;
        const pickPattern = PATTERNS[(Math.random() * PATTERNS.length) | 0];
        fadeDelays = pickPattern();
      }
    } else if (phase === 'fading') {
      if (now - phaseStart >= FADE_DURATION + 50) {
        newBuild();
      }
    }

    draw();
  }

  newBuild();
  frame();

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
  };
}
