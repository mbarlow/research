// Strange attractor visualization — Lorenz, Rössler, Aizawa as line trails
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

// ─── Attractor definitions ──────────────────────────────────────────────────
const ATTRACTORS = {
  lorenz: {
    name: 'Lorenz',
    params: { sigma: 10, rho: 28, beta: 8 / 3 },
    derivative(x, y, z, p) {
      return [p.sigma * (y - x), x * (p.rho - z) - y, x * y - p.beta * z];
    },
    scale: 0.07,
    offset: [0, 0, -1.5],
  },
  rossler: {
    name: 'Rössler',
    params: { a: 0.2, b: 0.2, c: 5.7 },
    derivative(x, y, z, p) {
      return [-y - z, x + p.a * y, p.b + z * (x - p.c)];
    },
    scale: 0.1,
    offset: [0, 0, 0],
  },
  aizawa: {
    name: 'Aizawa',
    params: { a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0.1 },
    derivative(x, y, z, p) {
      return [
        (z - p.b) * x - p.d * y,
        p.d * x + (z - p.b) * y,
        p.c + p.a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + p.e * z) + p.f * z * x * x * x,
      ];
    },
    scale: 0.7,
    offset: [0, 0, 0],
  },
};

const ATTRACTOR_KEYS = Object.keys(ATTRACTORS);

export function init(canvas, container, palette) {
  const hex = palette.as.hex;
  const PALETTE = palette.as.three.hues;
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(hex.bg, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0, 6);

  // Each particle is a line trail using shift-based position management
  const TRAIL_LENGTH = 2000;
  const NUM_PARTICLES = 6;

  const particles = [];

  for (let p = 0; p < NUM_PARTICLES; p++) {
    const positions = new Float32Array(TRAIL_LENGTH * 3);
    const colors = new Float32Array(TRAIL_LENGTH * 3);
    const baseColor = PALETTE[p % PALETTE.length];

    // Gradient from bright (head) to dim (tail)
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const t = i / TRAIL_LENGTH;
      const fade = Math.pow(1 - t, 0.6);
      colors[i * 3] = baseColor.r * fade;
      colors[i * 3 + 1] = baseColor.g * fade;
      colors[i * 3 + 2] = baseColor.b * fade;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setDrawRange(0, 0);

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const line = new THREE.Line(geo, mat);
    scene.add(line);

    particles.push({
      line,
      geo,
      mat,
      positions,
      // Simulation state (unscaled coordinates)
      x: 0.1 * (p + 1) + Math.random() * 0.01,
      y: 0.1 * Math.sin(p * 1.5),
      z: 0.1 * Math.cos(p * 2.0),
      trailCount: 0,
    });
  }

  let currentAttractorIdx = 0;
  let attractor = ATTRACTORS[ATTRACTOR_KEYS[0]];
  let switchTimer = 0;

  function resetParticles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x = 0.1 * (i + 1) + Math.random() * 0.5;
      p.y = 0.1 * Math.sin(i * 1.5) + Math.random() * 0.5;
      p.z = 0.1 * Math.cos(i * 2.0) + Math.random() * 0.5;
      p.trailCount = 0;
      p.geo.setDrawRange(0, 0);
    }
  }

  const clock = new THREE.Clock();
  let running = true;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const dt = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // Switch attractor every 14 seconds
    switchTimer += dt;
    if (switchTimer > 14.0) {
      switchTimer = 0;
      currentAttractorIdx = (currentAttractorIdx + 1) % ATTRACTOR_KEYS.length;
      attractor = ATTRACTORS[ATTRACTOR_KEYS[currentAttractorIdx]];
      resetParticles();
    }

    const simDt = 0.004;
    const stepsPerFrame = 8;

    for (const p of particles) {
      for (let s = 0; s < stepsPerFrame; s++) {
        // RK4-ish: two half-steps for stability
        const [dx1, dy1, dz1] = attractor.derivative(p.x, p.y, p.z, attractor.params);
        const mx = p.x + dx1 * simDt * 0.5;
        const my = p.y + dy1 * simDt * 0.5;
        const mz = p.z + dz1 * simDt * 0.5;
        const [dx2, dy2, dz2] = attractor.derivative(mx, my, mz, attractor.params);
        p.x += dx2 * simDt;
        p.y += dy2 * simDt;
        p.z += dz2 * simDt;

        // Divergence guard
        if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) {
          p.x = Math.random() * 0.5;
          p.y = Math.random() * 0.5;
          p.z = Math.random() * 0.5;
          continue;
        }

        // Shift trail: move everything down by one slot
        const pos = p.positions;
        for (let i = (Math.min(p.trailCount, TRAIL_LENGTH) - 1); i > 0; i--) {
          pos[i * 3] = pos[(i - 1) * 3];
          pos[i * 3 + 1] = pos[(i - 1) * 3 + 1];
          pos[i * 3 + 2] = pos[(i - 1) * 3 + 2];
        }

        // Write new head position (scaled + offset)
        const sc = attractor.scale;
        const off = attractor.offset;
        pos[0] = p.x * sc + off[0];
        pos[1] = p.y * sc + off[1];
        pos[2] = p.z * sc + off[2];

        if (p.trailCount < TRAIL_LENGTH) p.trailCount++;
      }

      p.geo.attributes.position.needsUpdate = true;
      p.geo.setDrawRange(0, p.trailCount);
    }

    // Slow camera orbit
    camera.position.x = Math.sin(elapsed * 0.1) * 5;
    camera.position.z = Math.cos(elapsed * 0.1) * 5;
    camera.position.y = Math.sin(elapsed * 0.06) * 2;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  return () => {
    running = false;
    window.removeEventListener('resize', onResize);
    for (const p of particles) {
      p.geo.dispose();
      p.mat.dispose();
    }
    renderer.dispose();
  };
}
