// Flow field visualization — curl noise driven particles with visible trails
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

// ─── Robust 3D gradient noise using Math.imul for safe 32-bit integer math ──
function hash3(ix, iy, iz) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 1440670567);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = n ^ (n >>> 16);
  return n;
}

function grad3(hash, dx, dy, dz) {
  const h = hash & 15;
  const u = h < 8 ? dx : dy;
  const v = h < 4 ? dy : (h === 12 || h === 14 ? dx : dz);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + t * (b - a);
}

function noise3D(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;

  const u = fade(fx);
  const v = fade(fy);
  const w = fade(fz);

  return lerp(
    lerp(
      lerp(grad3(hash3(ix, iy, iz), fx, fy, fz), grad3(hash3(ix + 1, iy, iz), fx - 1, fy, fz), u),
      lerp(grad3(hash3(ix, iy + 1, iz), fx, fy - 1, fz), grad3(hash3(ix + 1, iy + 1, iz), fx - 1, fy - 1, fz), u),
      v
    ),
    lerp(
      lerp(grad3(hash3(ix, iy, iz + 1), fx, fy, fz - 1), grad3(hash3(ix + 1, iy, iz + 1), fx - 1, fy, fz - 1), u),
      lerp(grad3(hash3(ix, iy + 1, iz + 1), fx, fy - 1, fz - 1), grad3(hash3(ix + 1, iy + 1, iz + 1), fx - 1, fy - 1, fz - 1), u),
      v
    ),
    w
  );
}

// ─── Curl noise: divergence-free vector field ───────────────────────────────
function curlNoise(x, y, z, t) {
  const e = 0.01;
  const px = x + t * 0.08;
  const py = y + t * 0.06;
  const pz = z + t * 0.04;

  // curl(F) of potential field (noise_a, noise_b, noise_c) with different offsets
  const na_y1 = noise3D(px, py + e, pz + 31.416);
  const na_y0 = noise3D(px, py - e, pz + 31.416);
  const na_z1 = noise3D(px, py, pz + e + 31.416);
  const na_z0 = noise3D(px, py, pz - e + 31.416);

  const nb_x1 = noise3D(px + e, py, pz + 47.123);
  const nb_x0 = noise3D(px - e, py, pz + 47.123);
  const nb_z1 = noise3D(px, py, pz + e + 47.123);
  const nb_z0 = noise3D(px, py, pz - e + 47.123);

  const nc_x1 = noise3D(px + e, py, pz + 67.891);
  const nc_x0 = noise3D(px - e, py, pz + 67.891);
  const nc_y1 = noise3D(px, py + e, pz + 67.891);
  const nc_y0 = noise3D(px, py - e, pz + 67.891);

  const inv2e = 1 / (2 * e);
  return [
    (nc_y1 - nc_y0) * inv2e - (nb_z1 - nb_z0) * inv2e,
    (na_z1 - na_z0) * inv2e - (nc_x1 - nc_x0) * inv2e,
    (nb_x1 - nb_x0) * inv2e - (na_y1 - na_y0) * inv2e,
  ];
}

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0e1a, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0, 8);

  // Particle configuration — fewer particles, longer trails for visible streaks
  const NUM_PARTICLES = 4000;
  const TRAIL_LENGTH = 24;
  const TOTAL_VERTS = NUM_PARTICLES * TRAIL_LENGTH;
  const BOUNDS = 3.0;

  const positions = new Float32Array(TOTAL_VERTS * 3);
  const colors = new Float32Array(TOTAL_VERTS * 3);
  const alphas = new Float32Array(TOTAL_VERTS);

  // Per-particle state
  const px = new Float32Array(NUM_PARTICLES);
  const py = new Float32Array(NUM_PARTICLES);
  const pz = new Float32Array(NUM_PARTICLES);
  const life = new Float32Array(NUM_PARTICLES);
  const maxLife = new Float32Array(NUM_PARTICLES);

  function resetParticle(i) {
    px[i] = (Math.random() - 0.5) * BOUNDS * 2;
    py[i] = (Math.random() - 0.5) * BOUNDS * 2;
    pz[i] = (Math.random() - 0.5) * BOUNDS * 2;
    life[i] = 0;
    maxLife[i] = 300 + Math.random() * 400;

    // Clear trail to current position
    for (let t = 0; t < TRAIL_LENGTH; t++) {
      const idx = (i * TRAIL_LENGTH + t) * 3;
      positions[idx] = px[i];
      positions[idx + 1] = py[i];
      positions[idx + 2] = pz[i];
    }
  }

  // Color palette: position-based hue gradient
  function colorParticle(i) {
    const hue = ((px[i] + BOUNDS) / (BOUNDS * 2) * 0.4 + 0.45 +
                 (py[i] + BOUNDS) / (BOUNDS * 2) * 0.15) % 1.0;
    const color = new THREE.Color().setHSL(hue, 0.75, 0.55);

    for (let t = 0; t < TRAIL_LENGTH; t++) {
      const vidx = i * TRAIL_LENGTH + t;
      const fade = Math.pow(1 - t / TRAIL_LENGTH, 0.7);
      colors[vidx * 3] = color.r;
      colors[vidx * 3 + 1] = color.g;
      colors[vidx * 3 + 2] = color.b;
      alphas[vidx] = fade * 0.7;
    }
  }

  // Initialize particles
  for (let i = 0; i < NUM_PARTICLES; i++) {
    resetParticle(i);
    life[i] = Math.random() * maxLife[i]; // stagger
    colorParticle(i);
  }

  const VERTEX_SHADER = `
    attribute float aAlpha;
    varying float vAlpha;
    varying vec3 vColor;
    void main() {
      vAlpha = aAlpha;
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = 2.5 * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const FRAGMENT_SHADER = `
    varying float vAlpha;
    varying vec3 vColor;
    void main() {
      float dist = length(gl_PointCoord - 0.5);
      if (dist > 0.5) discard;
      float alpha = vAlpha * smoothstep(0.5, 0.15, dist);
      gl_FragColor = vec4(vColor, alpha);
    }
  `;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  const clock = new THREE.Clock();
  let running = true;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();
    const speed = 0.03;

    for (let i = 0; i < NUM_PARTICLES; i++) {
      life[i]++;

      // Reset dead or escaped particles
      if (life[i] > maxLife[i] ||
          Math.abs(px[i]) > BOUNDS * 1.5 ||
          Math.abs(py[i]) > BOUNDS * 1.5 ||
          Math.abs(pz[i]) > BOUNDS * 1.5) {
        resetParticle(i);
        colorParticle(i);
        continue;
      }

      // Shift trail positions down (tail gets old head positions)
      for (let tr = TRAIL_LENGTH - 1; tr > 0; tr--) {
        const dstIdx = (i * TRAIL_LENGTH + tr) * 3;
        const srcIdx = (i * TRAIL_LENGTH + tr - 1) * 3;
        positions[dstIdx] = positions[srcIdx];
        positions[dstIdx + 1] = positions[srcIdx + 1];
        positions[dstIdx + 2] = positions[srcIdx + 2];
      }

      // Advect by curl noise
      const [cx, cy, cz] = curlNoise(px[i] * 0.35, py[i] * 0.35, pz[i] * 0.35, t);
      px[i] += cx * speed;
      py[i] += cy * speed;
      pz[i] += cz * speed;

      // Write new head position
      const headIdx = (i * TRAIL_LENGTH) * 3;
      positions[headIdx] = px[i];
      positions[headIdx + 1] = py[i];
      positions[headIdx + 2] = pz[i];
    }

    geo.attributes.position.needsUpdate = true;

    // Slow camera orbit
    camera.position.x = Math.sin(t * 0.08) * 7;
    camera.position.z = Math.cos(t * 0.08) * 7;
    camera.position.y = Math.sin(t * 0.05) * 2.5;
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
    geo.dispose();
    mat.dispose();
    renderer.dispose();
  };
}
