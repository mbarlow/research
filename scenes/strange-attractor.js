// Strange attractor visualization — Lorenz system rendered as particle traces
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

// ─── Attractor definitions ──────────────────────────────────────────────────
const ATTRACTORS = {
  lorenz: {
    name: 'Lorenz',
    params: { sigma: 10, rho: 28, beta: 8 / 3 },
    step(x, y, z, p, dt) {
      const dx = p.sigma * (y - x);
      const dy = x * (p.rho - z) - y;
      const dz = x * y - p.beta * z;
      return [x + dx * dt, y + dy * dt, z + dz * dt];
    },
    scale: 0.06,
    offset: [0, 0, -1.5],
  },
  rossler: {
    name: 'Rössler',
    params: { a: 0.2, b: 0.2, c: 5.7 },
    step(x, y, z, p, dt) {
      const dx = -y - z;
      const dy = x + p.a * y;
      const dz = p.b + z * (x - p.c);
      return [x + dx * dt, y + dy * dt, z + dz * dt];
    },
    scale: 0.12,
    offset: [0, 0, 0],
  },
  aizawa: {
    name: 'Aizawa',
    params: { a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0.1 },
    step(x, y, z, p, dt) {
      const dx = (z - p.b) * x - p.d * y;
      const dy = p.d * x + (z - p.b) * y;
      const dz = p.c + p.a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + p.e * z) + p.f * z * x * x * x;
      return [x + dx * dt, y + dy * dt, z + dz * dt];
    },
    scale: 0.8,
    offset: [0, 0, 0],
  },
};

const ATTRACTOR_KEYS = Object.keys(ATTRACTORS);

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0e1a, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0, 6);

  // Particle system for attractor trail
  const TRAIL_LENGTH = 8000;
  const NUM_PARTICLES = 6;

  const particles = [];

  for (let p = 0; p < NUM_PARTICLES; p++) {
    const positions = new Float32Array(TRAIL_LENGTH * 3);
    const colors = new Float32Array(TRAIL_LENGTH * 3);

    // Assign each particle a distinct hue
    const hue = p / NUM_PARTICLES;
    const color = new THREE.Color().setHSL(hue, 0.8, 0.6);

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      // Fade alpha through color brightness along trail
      const t = i / TRAIL_LENGTH;
      const fade = Math.pow(1 - t, 0.5);
      colors[i * 3] = color.r * fade;
      colors[i * 3 + 1] = color.g * fade;
      colors[i * 3 + 2] = color.b * fade;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setDrawRange(0, 0);

    const mat = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    particles.push({
      points,
      geo,
      mat,
      positions,
      x: 0.1 * (p + 1) + Math.random() * 0.01,
      y: 0.1 * Math.sin(p * 1.5),
      z: 0.1 * Math.cos(p * 2.0),
      writeIndex: 0,
      filled: false,
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
      p.writeIndex = 0;
      p.filled = false;
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

    // Switch attractor every 12 seconds
    switchTimer += dt;
    if (switchTimer > 12.0) {
      switchTimer = 0;
      currentAttractorIdx = (currentAttractorIdx + 1) % ATTRACTOR_KEYS.length;
      attractor = ATTRACTORS[ATTRACTOR_KEYS[currentAttractorIdx]];
      resetParticles();
    }

    const simDt = 0.005;
    const stepsPerFrame = 12;

    for (const p of particles) {
      for (let s = 0; s < stepsPerFrame; s++) {
        [p.x, p.y, p.z] = attractor.step(p.x, p.y, p.z, attractor.params, simDt);

        // Check for NaN/Inf — reset if diverged
        if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) {
          p.x = Math.random() * 0.5;
          p.y = Math.random() * 0.5;
          p.z = Math.random() * 0.5;
          continue;
        }

        const idx = p.writeIndex * 3;
        const sc = attractor.scale;
        const off = attractor.offset;
        p.positions[idx] = p.x * sc + off[0];
        p.positions[idx + 1] = p.y * sc + off[1];
        p.positions[idx + 2] = p.z * sc + off[2];

        p.writeIndex = (p.writeIndex + 1) % TRAIL_LENGTH;
        if (p.writeIndex === 0) p.filled = true;
      }

      p.geo.attributes.position.needsUpdate = true;
      p.geo.setDrawRange(0, p.filled ? TRAIL_LENGTH : p.writeIndex);
    }

    // Camera orbit
    camera.position.x = Math.sin(elapsed * 0.12) * 5;
    camera.position.z = Math.cos(elapsed * 0.12) * 5;
    camera.position.y = Math.sin(elapsed * 0.08) * 2;
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
