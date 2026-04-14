// Animated self-attention heatmap visualization
// Cycles through 4 attention heads with smooth interpolation
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

// --- Attention weight matrices for 4 heads ---
// Tokens: "The cat sat on the mat ." (7 tokens)

const TOKENS = ['The', 'cat', 'sat', 'on', 'the', 'mat', '.'];
const N = TOKENS.length;
const HEAD_LABELS = [
  'Head 0: Previous Token',
  'Head 1: Identity / Self',
  'Head 2: First Token (BOS)',
  'Head 3: Broad / Uniform',
];

// Head 0: Attends strongly to the previous token (shifted diagonal)
const head0 = [
  [0.85, 0.03, 0.02, 0.02, 0.03, 0.02, 0.03],
  [0.72, 0.12, 0.03, 0.03, 0.04, 0.03, 0.03],
  [0.05, 0.75, 0.08, 0.03, 0.03, 0.03, 0.03],
  [0.04, 0.04, 0.74, 0.08, 0.04, 0.03, 0.03],
  [0.04, 0.03, 0.05, 0.72, 0.08, 0.04, 0.04],
  [0.03, 0.03, 0.03, 0.05, 0.73, 0.08, 0.05],
  [0.03, 0.03, 0.03, 0.03, 0.05, 0.72, 0.11],
];

// Head 1: Identity attention (strong diagonal)
const head1 = [
  [0.80, 0.04, 0.03, 0.03, 0.04, 0.03, 0.03],
  [0.05, 0.78, 0.04, 0.03, 0.04, 0.03, 0.03],
  [0.03, 0.05, 0.76, 0.04, 0.04, 0.04, 0.04],
  [0.03, 0.03, 0.05, 0.77, 0.04, 0.04, 0.04],
  [0.04, 0.03, 0.03, 0.04, 0.76, 0.05, 0.05],
  [0.03, 0.03, 0.04, 0.03, 0.05, 0.78, 0.04],
  [0.03, 0.03, 0.03, 0.04, 0.04, 0.04, 0.79],
];

// Head 2: First-token attention (BOS/anchor pattern)
const head2 = [
  [0.82, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03],
  [0.68, 0.14, 0.04, 0.04, 0.04, 0.03, 0.03],
  [0.65, 0.06, 0.12, 0.05, 0.04, 0.04, 0.04],
  [0.62, 0.05, 0.06, 0.12, 0.05, 0.05, 0.05],
  [0.60, 0.05, 0.05, 0.06, 0.11, 0.07, 0.06],
  [0.58, 0.05, 0.05, 0.05, 0.06, 0.12, 0.09],
  [0.55, 0.06, 0.05, 0.05, 0.06, 0.07, 0.16],
];

// Head 3: Broad / distributed attention
const head3 = [
  [0.28, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12],
  [0.16, 0.18, 0.14, 0.13, 0.14, 0.12, 0.13],
  [0.14, 0.15, 0.16, 0.14, 0.14, 0.13, 0.14],
  [0.13, 0.14, 0.14, 0.17, 0.15, 0.13, 0.14],
  [0.13, 0.13, 0.14, 0.14, 0.17, 0.15, 0.14],
  [0.12, 0.13, 0.13, 0.14, 0.15, 0.18, 0.15],
  [0.12, 0.12, 0.13, 0.13, 0.14, 0.15, 0.21],
];

const HEADS = [head0, head1, head2, head3];

// --- Palette-driven color ramp: bg → elevated → accent → text ---

function makeRamp(palette) {
  const stops = [
    { t: 0.00, rgb: palette.bg },
    { t: 0.30, rgb: palette.elevated },
    { t: 0.55, rgb: palette.hues[4] },   // teal/cool
    { t: 0.78, rgb: palette.accent },    // hot
    { t: 1.00, rgb: palette.text },      // cream peak
  ];
  return (value) => {
    const t = Math.max(0, Math.min(1, value));
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i].t) {
        const a = stops[i - 1], b = stops[i];
        const f = (t - a.t) / (b.t - a.t);
        const r = a.rgb.r + (b.rgb.r - a.rgb.r) * f;
        const g = a.rgb.g + (b.rgb.g - a.rgb.g) * f;
        const bl = a.rgb.b + (b.rgb.b - a.rgb.b) * f;
        return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(bl * 255)})`;
      }
    }
    return `rgb(0,0,0)`;
  };
}

// --- Interpolation between two matrices ---

function lerpMatrix(matA, matB, t) {
  const result = [];
  for (let i = 0; i < matA.length; i++) {
    result[i] = [];
    for (let j = 0; j < matA[i].length; j++) {
      result[i][j] = matA[i][j] + (matB[i][j] - matA[i][j]) * t;
    }
  }
  return result;
}

// --- Smooth step easing ---

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

export function init(canvas, container, palette) {
  const css = palette.as.css;
  const attentionColor = makeRamp(palette);
  const dpr = Math.min(window.devicePixelRatio, 2);
  let width = container.clientWidth;
  let height = container.clientHeight || 420;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const CYCLE_DURATION = 3000; // ms per head
  const TRANSITION_DURATION = 800; // ms of interpolation between heads
  let running = true;
  let startTime = performance.now();

  function draw(timestamp) {
    if (!running) return;
    requestAnimationFrame(draw);

    const elapsed = Math.max(0, timestamp - startTime);
    const totalCycle = CYCLE_DURATION;
    const cyclePos = (elapsed % (totalCycle * HEADS.length)) / totalCycle;
    const currentHead = Math.floor(cyclePos) % HEADS.length;
    const nextHead = (currentHead + 1) % HEADS.length;
    const withinCycle = (cyclePos - currentHead);

    // Determine interpolation factor
    let matrix;
    let displayLabel;
    const transitionFraction = TRANSITION_DURATION / CYCLE_DURATION;

    if (withinCycle > (1 - transitionFraction)) {
      // In transition zone
      const t = (withinCycle - (1 - transitionFraction)) / transitionFraction;
      const eased = smoothStep(t);
      matrix = lerpMatrix(HEADS[currentHead], HEADS[nextHead], eased);
      displayLabel = eased < 0.5 ? HEAD_LABELS[currentHead] : HEAD_LABELS[nextHead];
    } else {
      matrix = HEADS[currentHead];
      displayLabel = HEAD_LABELS[currentHead];
    }

    // Layout constants
    const padding = 16;
    const labelAreaX = 70;
    const labelAreaY = 48;
    const headerHeight = 36;
    const availW = width - padding * 2 - labelAreaX;
    const availH = height - padding * 2 - labelAreaY - headerHeight;
    const cellSize = Math.min(Math.floor(availW / N), Math.floor(availH / N), 48);
    const gridW = cellSize * N;
    const gridH = cellSize * N;
    const originX = padding + labelAreaX + (availW - gridW) / 2;
    const originY = padding + headerHeight + labelAreaY + (availH - gridH) / 2;

    // Clear
    ctx.fillStyle = css.bg;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = css.text;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Self-Attention Weights', width / 2, padding);

    // Head label
    ctx.fillStyle = css.textSecondary;
    ctx.font = '12px monospace';
    ctx.fillText(displayLabel, width / 2, padding + 18);

    // Draw column labels (top)
    ctx.fillStyle = css.textSecondary;
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (let j = 0; j < N; j++) {
      const cx = originX + j * cellSize + cellSize / 2;
      ctx.save();
      ctx.translate(cx, originY - 6);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(TOKENS[j], 0, 0);
      ctx.restore();
    }

    // Label axis: "Key" on top
    ctx.fillStyle = css.accent;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Key \u2192', originX + gridW / 2, originY - 32);

    // Draw row labels (left) and "Query" axis label
    ctx.fillStyle = css.textSecondary;
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < N; i++) {
      const cy = originY + i * cellSize + cellSize / 2;
      ctx.fillText(TOKENS[i], originX - 8, cy);
    }

    // Query axis label (vertical)
    ctx.save();
    ctx.fillStyle = css.accent;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.translate(originX - labelAreaX + 8, originY + gridH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Query \u2192', 0, 0);
    ctx.restore();

    // Draw heatmap cells
    const cellPad = 1;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const val = matrix[i][j];
        const x = originX + j * cellSize + cellPad;
        const y = originY + i * cellSize + cellPad;
        const s = cellSize - cellPad * 2;

        ctx.fillStyle = attentionColor(val);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, s, s, 2);
        } else {
          ctx.rect(x, y, s, s);
        }
        ctx.fill();

        // Draw value text in cells if large enough
        if (cellSize >= 32) {
          ctx.fillStyle = val > 0.6 ? css.bg : css.text;
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(val.toFixed(2), x + s / 2, y + s / 2);
        }
      }
    }

    // Grid outline
    ctx.strokeStyle = '#21262d';
    ctx.lineWidth = 1;
    ctx.strokeRect(originX, originY, gridW, gridH);

    // Color legend bar
    const legendY = originY + gridH + 20;
    const legendW = Math.min(gridW, 200);
    const legendH = 10;
    const legendX = originX + (gridW - legendW) / 2;

    if (legendY + legendH + 16 < height) {
      for (let px = 0; px < legendW; px++) {
        ctx.fillStyle = attentionColor(px / legendW);
        ctx.fillRect(legendX + px, legendY, 1, legendH);
      }
      ctx.strokeStyle = '#30363d';
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, legendY, legendW, legendH);

      ctx.fillStyle = '#8b949e';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('0.0', legendX, legendY + legendH + 3);
      ctx.textAlign = 'right';
      ctx.fillText('1.0', legendX + legendW, legendY + legendH + 3);
      ctx.textAlign = 'center';
      ctx.fillText('Attention Weight', legendX + legendW / 2, legendY + legendH + 3);
    }

    // Head indicator dots
    const dotY = height - padding - 4;
    const dotSpacing = 16;
    const dotsW = (HEADS.length - 1) * dotSpacing;
    const dotsStartX = width / 2 - dotsW / 2;
    for (let h = 0; h < HEADS.length; h++) {
      const dx = dotsStartX + h * dotSpacing;
      ctx.beginPath();
      ctx.arc(dx, dotY, 3, 0, Math.PI * 2);
      ctx.fillStyle = h === currentHead ? '#58a6ff' : '#30363d';
      ctx.fill();
    }
  }

  requestAnimationFrame(draw);

  function onResize() {
    width = container.clientWidth;
    height = container.clientHeight || 420;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  window.addEventListener('resize', onResize);

  return () => {
    running = false;
    window.removeEventListener('resize', onResize);
  };
}
