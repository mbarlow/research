// Tiny WFC running on a rotating Three.js cube in the nav logo slot.
// Each of the 6 faces is subdivided into a per-face WFC grid. The full
// build/hold/fade cycle plays across all faces in lockstep, then restarts.

import * as THREE from 'three';

const PER_FACE = 5;          // grid resolution per cube face
const FACES = 6;
const TOTAL_CELLS = FACES * PER_FACE * PER_FACE;
const CUBE_SIZE = 1;

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

const opposite = [2, 3, 0, 1];
function canPlace(a, dir, b) {
  return TILE_SPECS[a].edges[dir] === TILE_SPECS[b].edges[opposite[dir]];
}

function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
  return {
    grass:    new THREE.Color(v('--text-muted',      '#6e6859')),
    road:     new THREE.Color(v('--accent',          '#e8541c')),
    junction: new THREE.Color(v('--accent-hover',    '#ff6b30')),
    water:    new THREE.Color(v('--text-secondary',  '#a89e87')),
    shore:    new THREE.Color(v('--callout-warning', '#d2a25a')),
    elevated: new THREE.Color(v('--bg-elevated',     '#1a1a1a')),
    edge:     new THREE.Color(v('--text-muted',      '#6e6859')),
  };
}

// Face definitions: each face is a child group with local +X = right,
// +Y = up, +Z = outward normal.
const FACE_TRANSFORMS = [
  { pos: [ 0, 0,  0.5], rot: [0, 0, 0] },             // +Z
  { pos: [ 0, 0, -0.5], rot: [0, Math.PI, 0] },       // -Z
  { pos: [ 0.5, 0, 0],  rot: [0,  Math.PI / 2, 0] },  // +X
  { pos: [-0.5, 0, 0],  rot: [0, -Math.PI / 2, 0] },  // -X
  { pos: [0,  0.5, 0],  rot: [-Math.PI / 2, 0, 0] },  // +Y
  { pos: [0, -0.5, 0],  rot: [ Math.PI / 2, 0, 0] },  // -Y
];

// Fade-out delay generators. Each takes the cells array and returns a
// per-cell delay in 0..1. Some are global, some per-face.
function patternRandom(cells) {
  return cells.map(() => Math.random());
}
function patternByWorldY(cells, dir = -1) {
  // dir = -1 → top-down; dir = +1 → bottom-up
  const ys = cells.map(c => c.localY * dir);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return ys.map(y => (y - minY) / Math.max(1e-6, maxY - minY));
}
function patternPerFaceSpiral(cells) {
  const delays = new Array(cells.length);
  for (let f = 0; f < FACES; f++) {
    const visited = Array(PER_FACE * PER_FACE).fill(false);
    let x = 0, y = 0, dir = 0;
    const dxs = [1, 0, -1, 0], dys = [0, 1, 0, -1];
    for (let r = 0; r < PER_FACE * PER_FACE; r++) {
      const idx = (f * PER_FACE * PER_FACE) + (y * PER_FACE + x);
      delays[idx] = r / (PER_FACE * PER_FACE - 1);
      visited[y * PER_FACE + x] = true;
      const nx = x + dxs[dir], ny = y + dys[dir];
      if (nx < 0 || nx >= PER_FACE || ny < 0 || ny >= PER_FACE || visited[ny * PER_FACE + nx]) {
        dir = (dir + 1) % 4;
      }
      x += dxs[dir]; y += dys[dir];
    }
  }
  return delays;
}
function patternPerFaceDiagonal(cells) {
  const max = (PER_FACE - 1) * 2;
  return cells.map(c => (c.gridX + c.gridY) / max);
}
function patternByDistanceFromCenter(cells) {
  const ds = cells.map(c => Math.hypot(c.localX, c.localY, c.localZ));
  const min = Math.min(...ds), max = Math.max(...ds);
  return ds.map(d => (d - min) / Math.max(1e-6, max - min));
}
function patternRandomShuffle(cells) {
  const order = cells.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }
  const delays = new Array(cells.length);
  order.forEach((idx, rank) => { delays[idx] = rank / (order.length - 1); });
  return delays;
}

const PATTERNS = [
  patternRandom,
  patternRandomShuffle,
  cells => patternByWorldY(cells, -1),
  cells => patternByWorldY(cells, +1),
  patternPerFaceSpiral,
  patternPerFaceDiagonal,
  patternByDistanceFromCenter,
];

export function initWfcLogo(canvas, sizePx) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(sizePx, sizePx, false);
  canvas.style.width = sizePx + 'px';
  canvas.style.height = sizePx + 'px';
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10);
  camera.position.set(0, 0, 2.4);
  camera.lookAt(0, 0, 0);

  const cube = new THREE.Group();
  scene.add(cube);

  let palette = readPalette();

  // Wireframe outline — stays visible when cells fade out.
  const wireGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE_SIZE * 1.001, CUBE_SIZE * 1.001, CUBE_SIZE * 1.001));
  const wireMat = new THREE.LineBasicMaterial({
    color: palette.edge,
    transparent: true,
    opacity: 0.35,
  });
  const wire = new THREE.LineSegments(wireGeo, wireMat);
  cube.add(wire);

  // Build cells per face.
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const cells = []; // flat array, indexed [face * PER_FACE^2 + y * PER_FACE + x]
  const faceGroups = [];
  const cellSize = CUBE_SIZE / PER_FACE;
  const innerScale = 0.78;

  FACE_TRANSFORMS.forEach((f, faceIdx) => {
    const faceGroup = new THREE.Group();
    faceGroup.position.set(f.pos[0], f.pos[1], f.pos[2]);
    faceGroup.rotation.set(f.rot[0], f.rot[1], f.rot[2]);
    cube.add(faceGroup);
    faceGroups.push(faceGroup);

    for (let y = 0; y < PER_FACE; y++) {
      for (let x = 0; x < PER_FACE; x++) {
        const mat = new THREE.MeshBasicMaterial({
          color: palette.elevated.clone(),
          transparent: true,
          opacity: 1,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(planeGeo, mat);
        const lx = (x + 0.5) / PER_FACE - 0.5;
        const ly = (y + 0.5) / PER_FACE - 0.5;
        mesh.position.set(lx * CUBE_SIZE, ly * CUBE_SIZE, 0.001);
        const s = cellSize * innerScale;
        mesh.scale.set(s, s, 1);
        faceGroup.add(mesh);

        // Cache world position once for fade-pattern math (cube starts unrotated).
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);

        cells.push({
          mesh, material: mat,
          baseScale: s,
          faceIdx, gridX: x, gridY: y,
          localX: worldPos.x, localY: worldPos.y, localZ: worldPos.z,
        });
      }
    }
  });

  // WFC state — one independent grid per face.
  const faceState = FACE_TRANSFORMS.map(() => ({
    grid: [], collapsed: [], complete: false,
  }));

  function resetFaceState() {
    for (const fs of faceState) {
      fs.grid = [];
      fs.collapsed = [];
      for (let i = 0; i < PER_FACE * PER_FACE; i++) {
        const all = new Set();
        for (let t = 0; t < TILE_SPECS.length; t++) all.add(t);
        fs.grid.push(all);
        fs.collapsed.push(-1);
      }
      fs.complete = false;
    }
  }

  function findLowestEntropy(fs) {
    let min = Infinity;
    let cands = [];
    for (let i = 0; i < PER_FACE * PER_FACE; i++) {
      if (fs.collapsed[i] >= 0) continue;
      const e = fs.grid[i].size;
      if (e === 0) return -2;
      if (e < min) { min = e; cands = [i]; }
      else if (e === min) cands.push(i);
    }
    if (cands.length === 0) return -1;
    return cands[(Math.random() * cands.length) | 0];
  }

  function collapseCell(fs, ci) {
    const opts = [...fs.grid[ci]];
    if (opts.length === 0) return false;
    const weights = opts.map(t => (t === 0 ? 3 : t === 8 ? 2 : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let chosen = opts[0];
    for (let i = 0; i < opts.length; i++) {
      r -= weights[i];
      if (r <= 0) { chosen = opts[i]; break; }
    }
    fs.collapsed[ci] = chosen;
    fs.grid[ci] = new Set([chosen]);
    return true;
  }

  function propagate(fs, start) {
    const stack = [start];
    const dirs = [
      { dx: 0, dy: -1, dir: 0 },
      { dx: 1, dy: 0,  dir: 1 },
      { dx: 0, dy: 1,  dir: 2 },
      { dx: -1, dy: 0, dir: 3 },
    ];
    while (stack.length) {
      const ci = stack.pop();
      const cx = ci % PER_FACE;
      const cy = (ci / PER_FACE) | 0;
      for (const { dx, dy, dir } of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= PER_FACE || ny < 0 || ny >= PER_FACE) continue;
        const ni = ny * PER_FACE + nx;
        if (fs.collapsed[ni] >= 0) continue;
        const before = fs.grid[ni].size;
        const valid = new Set();
        for (const a of fs.grid[ci]) for (const b of fs.grid[ni]) {
          if (canPlace(a, dir, b)) valid.add(b);
        }
        if (valid.size < before) {
          fs.grid[ni] = valid;
          if (valid.size > 0) stack.push(ni);
        }
      }
    }
  }

  function stepFace(fs) {
    if (fs.complete) return 'done';
    const ci = findLowestEntropy(fs);
    if (ci === -1) { fs.complete = true; return 'done'; }
    if (ci === -2) return 'contradiction';
    if (!collapseCell(fs, ci)) return 'contradiction';
    propagate(fs, ci);
    return 'ok';
  }

  function colorForCell(faceIdx, cellIdx) {
    const fs = faceState[faceIdx];
    if (fs.collapsed[cellIdx] < 0) return palette.elevated;
    return palette[TILE_SPECS[fs.collapsed[cellIdx]].kind];
  }

  // Per-face brightness based on world normal vs. view direction.
  // Faces angled away from the camera get darkened.
  const faceBrightness = new Array(FACES).fill(1);
  const _q = new THREE.Quaternion();
  const _normal = new THREE.Vector3();
  const _toCam = new THREE.Vector3();
  const AMBIENT = 0.35;
  const DIRECT = 0.65;

  function computeFaceLighting() {
    _toCam.subVectors(camera.position, cube.position).normalize();
    for (let f = 0; f < FACES; f++) {
      faceGroups[f].getWorldQuaternion(_q);
      _normal.set(0, 0, 1).applyQuaternion(_q);
      const dot = Math.max(0, _normal.dot(_toCam));
      faceBrightness[f] = AMBIENT + DIRECT * dot;
    }
  }

  function applyCellColors() {
    for (let f = 0; f < FACES; f++) {
      const b = faceBrightness[f];
      for (let i = 0; i < PER_FACE * PER_FACE; i++) {
        const cell = cells[f * PER_FACE * PER_FACE + i];
        cell.material.color.copy(colorForCell(f, i)).multiplyScalar(b);
      }
    }
    wireMat.color.copy(palette.edge).multiplyScalar(0.7);
  }

  // Phase machine
  const STEPS_PER_SEC = 28;     // per-face WFC collapses per second (across all 6)
  const HOLD_MS = 2000;
  const FADE_DURATION = 1500;
  const FADE_PER_CELL = 500;

  let phase, phaseStart, stepAccumMs, fadeDelays;

  function newBuild() {
    palette = readPalette();
    wireMat.color.copy(palette.edge);
    resetFaceState();
    /* colors applied each frame in the main loop */
    for (const c of cells) {
      c.material.opacity = 1;
      c.mesh.scale.set(c.baseScale, c.baseScale, 1);
    }
    phase = 'building';
    phaseStart = performance.now();
    stepAccumMs = 0;
  }

  function allFacesComplete() {
    return faceState.every(fs => fs.complete);
  }

  let lastFrame = performance.now();
  let raf = 0;
  let alive = true;
  let rotX = 0, rotY = 0;

  function frame() {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = now - lastFrame;
    lastFrame = now;

    // Cube rotation — slightly faster than the hello-world example so it
    // reads as motion at the small scale.
    rotX += 0.0009 * dt;
    rotY += 0.0014 * dt;
    cube.rotation.x = rotX;
    cube.rotation.y = rotY;

    // Cube scale: grow during build, gentle breath during hold,
    // contract during fade. Tied to the same cycle as the WFC.
    let targetScale;
    if (phase === 'building') {
      let collapsedCount = 0;
      for (const fs of faceState) {
        for (let i = 0; i < fs.collapsed.length; i++) if (fs.collapsed[i] >= 0) collapsedCount++;
      }
      const p = collapsedCount / TOTAL_CELLS;
      // Ease-out: starts smaller, settles into full size as the build completes.
      targetScale = 0.55 + 0.45 * (1 - Math.pow(1 - p, 2));
    } else if (phase === 'holding') {
      const t = (now - phaseStart) / 1000;
      targetScale = 1.0 + 0.045 * Math.sin(t * 3.2);
    } else {
      const p = Math.min(1, (now - phaseStart) / FADE_DURATION);
      targetScale = 1.0 - 0.45 * (p * p);
    }
    cube.scale.setScalar(targetScale);

    if (phase === 'building') {
      stepAccumMs += dt;
      const stepMs = 1000 / STEPS_PER_SEC;
      while (stepAccumMs >= stepMs) {
        stepAccumMs -= stepMs;
        // Round-robin step one face per WFC tick.
        let progressed = false;
        for (let f = 0; f < FACES; f++) {
          const fs = faceState[f];
          if (fs.complete) continue;
          const r = stepFace(fs);
          if (r === 'contradiction') {
            // Reset just this face.
            fs.grid = [];
            fs.collapsed = [];
            for (let i = 0; i < PER_FACE * PER_FACE; i++) {
              const all = new Set();
              for (let t = 0; t < TILE_SPECS.length; t++) all.add(t);
              fs.grid.push(all);
              fs.collapsed.push(-1);
            }
            fs.complete = false;
          }
          progressed = true;
        }
        /* colors applied each frame in the main loop */
        if (!progressed && allFacesComplete()) {
          phase = 'holding';
          phaseStart = now;
          break;
        }
      }
      if (allFacesComplete() && phase === 'building') {
        phase = 'holding';
        phaseStart = now;
      }
    } else if (phase === 'holding') {
      if (now - phaseStart >= HOLD_MS) {
        phase = 'fading';
        phaseStart = now;
        const pick = PATTERNS[(Math.random() * PATTERNS.length) | 0];
        fadeDelays = pick(cells);
      }
    } else if (phase === 'fading') {
      const elapsed = now - phaseStart;
      const span = FADE_DURATION - FADE_PER_CELL;
      for (let i = 0; i < cells.length; i++) {
        const startMs = fadeDelays[i] * span;
        const localT = Math.max(0, Math.min(1, (elapsed - startMs) / FADE_PER_CELL));
        const k = 1 - localT;
        cells[i].material.opacity = k;
        const s = cells[i].baseScale * k;
        cells[i].mesh.scale.set(s, s, 1);
      }
      if (elapsed >= FADE_DURATION + 80) {
        newBuild();
      }
    }

    computeFaceLighting();
    applyCellColors();

    renderer.render(scene, camera);
  }

  newBuild();
  frame();

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    planeGeo.dispose();
    wireGeo.dispose();
    wireMat.dispose();
    cells.forEach(c => c.material.dispose());
    renderer.dispose();
  };
}
