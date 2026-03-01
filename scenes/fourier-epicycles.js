// Fourier epicycle visualization using Canvas 2D
// Approximates a square wave using chained rotating circles (epicycles)
// Left side: rotating epicycles. Right side: scrolling waveform.

import * as THREE from 'three';

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  canvas.width = width * Math.min(window.devicePixelRatio, 2);
  canvas.height = height * Math.min(window.devicePixelRatio, 2);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio, 2);
  ctx.scale(dpr, dpr);

  // --- Colors ---
  const BG = '#0a0e17';
  const CIRCLE_STROKE = 'rgba(100, 140, 200, 0.25)';
  const RADIUS_LINE = 'rgba(100, 140, 200, 0.5)';
  const TIP_COLOR = '#e8c170';
  const WAVE_COLOR = '#6ec6ff';
  const CONNECT_LINE = 'rgba(110, 198, 255, 0.35)';
  const AXIS_COLOR = 'rgba(255, 255, 255, 0.08)';
  const TEXT_COLOR = 'rgba(255, 255, 255, 0.4)';
  const HARMONIC_COLORS = [
    '#6ec6ff', '#e8c170', '#a78bfa', '#34d399',
    '#f87171', '#fbbf24', '#60a5fa', '#c084fc',
    '#4ade80', '#fb923c', '#38bdf8', '#f472b6',
  ];

  // --- Fourier coefficients for a square wave ---
  // Square wave: sum of sin(n*t) / n for odd n = 1, 3, 5, 7, ...
  const NUM_HARMONICS = 10;

  function getSquareWaveCoefficients() {
    const coeffs = [];
    for (let i = 0; i < NUM_HARMONICS; i++) {
      const n = 2 * i + 1; // odd harmonics: 1, 3, 5, 7, ...
      coeffs.push({
        freq: n,
        amplitude: 1.0 / n,  // 4/pi * 1/n, we skip the 4/pi scale factor
        phase: 0,
      });
    }
    return coeffs;
  }

  const coefficients = getSquareWaveCoefficients();

  // --- State ---
  const waveHistory = [];
  const MAX_WAVE_POINTS = 500;
  let time = 0;
  const SPEED = 0.015;

  // --- Layout ---
  function getLayout() {
    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    const epicycleCenterX = w * 0.28;
    const epicycleCenterY = h * 0.5;
    const baseRadius = Math.min(w * 0.15, h * 0.28);
    const waveStartX = w * 0.48;
    const waveEndX = w * 0.95;
    const waveY = h * 0.5;
    const waveAmplitude = baseRadius * 1.1;
    return { w, h, epicycleCenterX, epicycleCenterY, baseRadius, waveStartX, waveEndX, waveY, waveAmplitude };
  }

  function drawBackground(layout) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, layout.w, layout.h);

    // Subtle horizontal axis for waveform
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(layout.waveStartX, layout.waveY);
    ctx.lineTo(layout.waveEndX, layout.waveY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawLabels(layout) {
    ctx.font = '11px monospace';
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.fillText('epicycles', layout.epicycleCenterX, layout.h - 12);
    ctx.fillText('waveform', (layout.waveStartX + layout.waveEndX) / 2, layout.h - 12);

    // Harmonic count
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'left';
    ctx.fillText(`n = ${NUM_HARMONICS} harmonics`, 10, 18);
  }

  function drawEpicycles(layout) {
    let x = layout.epicycleCenterX;
    let y = layout.epicycleCenterY;

    for (let i = 0; i < coefficients.length; i++) {
      const c = coefficients[i];
      const radius = c.amplitude * layout.baseRadius;
      const angle = c.freq * time + c.phase;

      // Draw circle
      ctx.strokeStyle = CIRCLE_STROKE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Compute next point
      const nx = x + radius * Math.cos(angle);
      const ny = y + radius * Math.sin(angle);

      // Draw radius line
      ctx.strokeStyle = HARMONIC_COLORS[i % HARMONIC_COLORS.length];
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // Small dot at joint
      ctx.fillStyle = HARMONIC_COLORS[i % HARMONIC_COLORS.length];
      ctx.beginPath();
      ctx.arc(nx, ny, 2, 0, Math.PI * 2);
      ctx.fill();

      x = nx;
      y = ny;
    }

    // Glowing tip
    ctx.fillStyle = TIP_COLOR;
    ctx.shadowColor = TIP_COLOR;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    return { x, y };
  }

  function drawWaveform(layout, tipY) {
    // Map tip Y to wave value (centered at layout.waveY)
    const value = tipY - layout.epicycleCenterY;

    // Add to history
    waveHistory.unshift(value);
    if (waveHistory.length > MAX_WAVE_POINTS) {
      waveHistory.pop();
    }

    // Draw the waveform
    const waveWidth = layout.waveEndX - layout.waveStartX;
    const step = waveWidth / MAX_WAVE_POINTS;

    ctx.strokeStyle = WAVE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < waveHistory.length; i++) {
      const wx = layout.waveStartX + i * step;
      const wy = layout.waveY + waveHistory[i];
      if (i === 0) {
        ctx.moveTo(wx, wy);
      } else {
        ctx.lineTo(wx, wy);
      }
    }
    ctx.stroke();

    // Fade out the tail
    const gradient = ctx.createLinearGradient(layout.waveStartX, 0, layout.waveEndX, 0);
    gradient.addColorStop(0, 'rgba(10, 14, 23, 0)');
    gradient.addColorStop(0.85, 'rgba(10, 14, 23, 0)');
    gradient.addColorStop(1, 'rgba(10, 14, 23, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(layout.waveStartX, 0, waveWidth, layout.h);

    return { x: layout.waveStartX, y: layout.waveY + value };
  }

  function drawConnectLine(tipX, tipY, waveX, waveY) {
    ctx.strokeStyle = CONNECT_LINE;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(waveX, waveY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawHarmonicLegend(layout) {
    const legendX = 10;
    const legendY = 30;
    const lineHeight = 14;

    ctx.font = '9px monospace';
    ctx.textAlign = 'left';

    const maxShow = Math.min(6, coefficients.length);
    for (let i = 0; i < maxShow; i++) {
      const c = coefficients[i];
      ctx.fillStyle = HARMONIC_COLORS[i % HARMONIC_COLORS.length];
      ctx.globalAlpha = 0.5;
      ctx.fillRect(legendX, legendY + i * lineHeight, 8, 8);
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(`n=${c.freq}  A=1/${c.freq}`, legendX + 12, legendY + i * lineHeight + 8);
    }
    if (coefficients.length > maxShow) {
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(`... +${coefficients.length - maxShow} more`, legendX + 12, legendY + maxShow * lineHeight + 8);
    }
  }

  // --- Animation loop ---
  let running = true;

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);

    const layout = getLayout();

    drawBackground(layout);
    drawLabels(layout);
    drawHarmonicLegend(layout);

    const tip = drawEpicycles(layout);
    const wavePoint = drawWaveform(layout, tip.y);
    drawConnectLine(tip.x, tip.y, wavePoint.x, wavePoint.y);

    time += SPEED;
  }

  frame();

  // --- Resize handler ---
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    // Update module-level width/height -- closure captures them
    // We rely on getLayout() reading from container directly each frame
  }

  window.addEventListener('resize', onResize);

  return () => {
    running = false;
    window.removeEventListener('resize', onResize);
  };
}
