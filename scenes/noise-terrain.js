// Procedural terrain heightmap using layered FBM noise
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

// --- Hash-based gradient noise (no external deps) ---

function hash2(ix, iy) {
  // Squirrel Eiserloh-style hash: fast, good distribution
  let n = ix * 374761393 + iy * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  return n;
}

function grad2(hash, dx, dy) {
  // 8 gradient directions
  const h = hash & 7;
  const u = h < 4 ? dx : dy;
  const v = h < 4 ? dy : dx;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + t * (b - a);
}

function noise2D(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const u = fade(fx);
  const v = fade(fy);

  const n00 = grad2(hash2(ix, iy), fx, fy);
  const n10 = grad2(hash2(ix + 1, iy), fx - 1, fy);
  const n01 = grad2(hash2(ix, iy + 1), fx, fy - 1);
  const n11 = grad2(hash2(ix + 1, iy + 1), fx - 1, fy - 1);

  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

// --- Fractal Brownian Motion ---

function fbm(x, y, octaves, lacunarity, persistence) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmp = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency);
    maxAmp += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxAmp;
}

// --- Domain warping ---

function warpedFBM(x, y, time) {
  const warpStrength = 0.4;
  const wx = fbm(x + 5.2 + time * 0.03, y + 1.3, 4, 2.0, 0.5);
  const wy = fbm(x + 1.7, y + 9.2 + time * 0.02, 4, 2.0, 0.5);
  return fbm(x + wx * warpStrength, y + wy * warpStrength, 6, 2.0, 0.5);
}

// --- Height-to-color mapping ---

function heightColor(h, color) {
  // Normalized h in roughly [-1, 1], remap to [0, 1]
  const t = h * 0.5 + 0.5;

  if (t < 0.3) {
    // Deep water -> shallow water
    const f = t / 0.3;
    color.setRGB(0.05 + f * 0.1, 0.1 + f * 0.15, 0.35 + f * 0.2);
  } else if (t < 0.45) {
    // Shore / sand
    const f = (t - 0.3) / 0.15;
    color.setRGB(0.15 + f * 0.25, 0.25 + f * 0.35, 0.55 - f * 0.2);
  } else if (t < 0.65) {
    // Grass / lowlands
    const f = (t - 0.45) / 0.2;
    color.setRGB(0.18 - f * 0.05, 0.45 + f * 0.15, 0.2 - f * 0.05);
  } else if (t < 0.8) {
    // Mountain rock
    const f = (t - 0.65) / 0.15;
    color.setRGB(0.35 + f * 0.2, 0.42 + f * 0.15, 0.32 + f * 0.15);
  } else {
    // Snow peaks
    const f = (t - 0.8) / 0.2;
    color.setRGB(0.7 + f * 0.28, 0.75 + f * 0.23, 0.8 + f * 0.18);
  }
}

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e17);
  scene.fog = new THREE.Fog(0x0a0e17, 12, 28);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 6, 10);

  // Lighting
  const ambient = new THREE.AmbientLight(0x334466, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
  sun.position.set(4, 8, 3);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x6688bb, 0.4);
  fill.position.set(-3, 4, -2);
  scene.add(fill);

  // Terrain geometry
  const segments = 128;
  const planeSize = 16;
  const geometry = new THREE.PlaneGeometry(planeSize, planeSize, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Preallocate color attribute
  const posAttr = geometry.attributes.position;
  const vertexCount = posAttr.count;
  const colors = new Float32Array(vertexCount * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const heightScale = 3.0;
  const noiseScale = 0.35;
  const color = new THREE.Color();

  function updateTerrain(time) {
    const offset = time * 0.08;
    const colorAttr = geometry.attributes.color;

    for (let i = 0; i < vertexCount; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);

      const nx = x * noiseScale + offset;
      const nz = z * noiseScale;

      const h = warpedFBM(nx, nz, time);
      posAttr.setY(i, h * heightScale);

      heightColor(h, color);
      colorAttr.setXYZ(i, color.r, color.g, color.b);
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  // Initial terrain
  updateTerrain(0);

  // Grid helper
  const grid = new THREE.GridHelper(planeSize, 16, 0x1a2233, 0x151b28);
  grid.position.y = -0.05;
  scene.add(grid);

  const clock = new THREE.Clock();
  let running = true;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();

    // Update terrain
    updateTerrain(t);

    // Gentle camera orbit
    const orbitRadius = 12;
    const orbitSpeed = 0.12;
    camera.position.x = Math.sin(t * orbitSpeed) * orbitRadius;
    camera.position.z = Math.cos(t * orbitSpeed) * orbitRadius;
    camera.position.y = 5.5 + Math.sin(t * 0.15) * 1.0;
    camera.lookAt(0, 0.5, 0);

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
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
