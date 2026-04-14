// Wave Function Collapse — step-by-step constraint propagation visualization
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

const GRID = 20;
const EDGE_COLORS = { green: 0, brown: 1, blue: 2 };

// Tile definitions: [top, right, bottom, left] edge colors
// Tile *colors* are built from the palette at init time.
const TILE_SPECS = [
  { edges: [0, 0, 0, 0], kind: 'grass', name: 'grass' },
  { edges: [0, 1, 0, 1], kind: 'road',  name: 'road-h' },
  { edges: [1, 0, 1, 0], kind: 'road',  name: 'road-v' },
  { edges: [1, 1, 1, 1], kind: 'junction', name: 'road-cross' },
  { edges: [1, 0, 0, 1], kind: 'road',  name: 'road-tl' },
  { edges: [1, 1, 0, 0], kind: 'road',  name: 'road-tr' },
  { edges: [0, 0, 1, 1], kind: 'road',  name: 'road-bl' },
  { edges: [0, 1, 1, 0], kind: 'road',  name: 'road-br' },
  { edges: [2, 2, 2, 2], kind: 'water', name: 'water' },
  { edges: [0, 0, 2, 0], kind: 'shore', name: 'shore-s' },
  { edges: [2, 0, 0, 0], kind: 'shore', name: 'shore-n' },
  { edges: [0, 2, 0, 0], kind: 'shore', name: 'shore-e' },
  { edges: [0, 0, 0, 2], kind: 'shore', name: 'shore-w' },
];

function buildTiles(palette) {
  const h = palette.hues;
  const KIND_COLORS = {
    grass:    palette.shade(h[3], -0.08), // forest, slightly darker
    road:     palette.shade(h[2], -0.15), // amber, earthy
    junction: palette.shade(h[2], -0.05), // brighter junction
    water:    palette.shade(h[4], -0.10), // teal deep
    shore:    palette.shade(h[4], 0.08),  // teal light
  };
  return TILE_SPECS.map(s => ({
    edges: s.edges,
    name: s.name,
    color: [KIND_COLORS[s.kind].r, KIND_COLORS[s.kind].g, KIND_COLORS[s.kind].b],
  }));
}

export function init(canvas, container, palette) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;
  const hex = palette.as.hex;

  const TILES = buildTiles(palette);

  // Adjacency: top/bottom edges must match, left/right edges must match
  function canPlace(tileA, dirFromA, tileB) {
    const opposite = [2, 3, 0, 1];
    return TILES[tileA].edges[dirFromA] === TILES[tileB].edges[opposite[dirFromA]];
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(width, height);
  renderer.setClearColor(hex.bg);

  const aspect = width / height;
  const viewSize = GRID * 0.6;
  const camera = new THREE.OrthographicCamera(
    -viewSize * aspect, viewSize * aspect,
    viewSize, -viewSize, 0.1, 100
  );
  camera.position.set(0, 10, 0);
  camera.lookAt(0, 0, 0);

  const scene = new THREE.Scene();

  // Cell meshes
  const cellGeo = new THREE.PlaneGeometry(0.9, 0.9);
  const cellMeshes = [];
  const cellMaterials = [];

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const mat = new THREE.MeshBasicMaterial({ color: hex.elevated });
      const mesh = new THREE.Mesh(cellGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x - GRID / 2 + 0.5, 0, y - GRID / 2 + 0.5);
      scene.add(mesh);
      cellMeshes.push(mesh);
      cellMaterials.push(mat);
    }
  }

  // WFC state
  let grid; // array of Sets (possible tile indices)
  let collapsed; // array of tile index or -1
  let collapseQueue;
  let isComplete;
  let stepTimer;
  let pauseTimer;

  function resetWFC() {
    grid = [];
    collapsed = [];
    for (let i = 0; i < GRID * GRID; i++) {
      const allTiles = new Set();
      for (let t = 0; t < TILES.length; t++) allTiles.add(t);
      grid.push(allTiles);
      collapsed.push(-1);
    }
    collapseQueue = [];
    isComplete = false;
    stepTimer = 0;
    pauseTimer = 0;

    // Reset visuals
    for (let i = 0; i < GRID * GRID; i++) {
      updateCellVisual(i);
    }
  }

  function idx(x, y) { return y * GRID + x; }

  function updateCellVisual(i) {
    if (collapsed[i] >= 0) {
      const tile = TILES[collapsed[i]];
      const c = tile.color;
      cellMaterials[i].color.setRGB(c[0], c[1], c[2]);
    } else {
      // Entropy: high entropy → cooler elevated bg, low entropy → warmer toward accent
      const entropy = grid[i].size / TILES.length;
      const lo = palette.elevated;
      const hi = palette.accent;
      const t = 1 - entropy;
      const r = lo.r + (hi.r - lo.r) * t * 0.35;
      const g = lo.g + (hi.g - lo.g) * t * 0.35;
      const b = lo.b + (hi.b - lo.b) * t * 0.35;
      cellMaterials[i].color.setRGB(r, g, b);
    }
  }

  function findLowestEntropy() {
    let minEntropy = Infinity;
    let candidates = [];
    for (let i = 0; i < GRID * GRID; i++) {
      if (collapsed[i] >= 0) continue;
      const e = grid[i].size;
      if (e === 0) return -2; // Contradiction
      if (e < minEntropy) {
        minEntropy = e;
        candidates = [i];
      } else if (e === minEntropy) {
        candidates.push(i);
      }
    }
    if (candidates.length === 0) return -1; // All collapsed
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function collapse(cellIdx) {
    const options = [...grid[cellIdx]];
    if (options.length === 0) return false;

    // Weighted random (prefer grass and water slightly)
    const weights = options.map(t => {
      if (t === 0) return 3; // grass
      if (t === 8) return 2; // water
      return 1;
    });
    const totalW = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalW;
    let chosen = options[0];
    for (let i = 0; i < options.length; i++) {
      r -= weights[i];
      if (r <= 0) { chosen = options[i]; break; }
    }

    collapsed[cellIdx] = chosen;
    grid[cellIdx] = new Set([chosen]);
    return true;
  }

  function propagate(startIdx) {
    const stack = [startIdx];
    const dirs = [
      { dx: 0, dy: -1, dir: 0 }, // top
      { dx: 1, dy: 0, dir: 1 },  // right
      { dx: 0, dy: 1, dir: 2 },  // bottom
      { dx: -1, dy: 0, dir: 3 }, // left
    ];

    while (stack.length > 0) {
      const ci = stack.pop();
      const cx = ci % GRID;
      const cy = Math.floor(ci / GRID);

      for (const { dx, dy, dir } of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;

        const ni = idx(nx, ny);
        if (collapsed[ni] >= 0) continue;

        const before = grid[ni].size;
        const validNeighbors = new Set();

        for (const myTile of grid[ci]) {
          for (const nTile of grid[ni]) {
            if (canPlace(myTile, dir, nTile)) {
              validNeighbors.add(nTile);
            }
          }
        }

        if (validNeighbors.size < before) {
          grid[ni] = validNeighbors;
          updateCellVisual(ni);
          if (validNeighbors.size > 0) {
            stack.push(ni);
          }
        }
      }
    }
  }

  function stepWFC() {
    const cellIdx = findLowestEntropy();
    if (cellIdx === -1) {
      isComplete = true;
      return;
    }
    if (cellIdx === -2) {
      // Contradiction — restart
      resetWFC();
      return;
    }

    if (!collapse(cellIdx)) {
      resetWFC();
      return;
    }

    updateCellVisual(cellIdx);

    // Flash the collapsed cell
    const tile = TILES[collapsed[cellIdx]];
    const c = tile.color;
    cellMaterials[cellIdx].color.setRGB(
      Math.min(c[0] + 0.3, 1),
      Math.min(c[1] + 0.3, 1),
      Math.min(c[2] + 0.3, 1)
    );

    propagate(cellIdx);
  }

  resetWFC();

  let running = true;
  const STEP_INTERVAL = 0.02; // seconds between collapse steps
  const PAUSE_DURATION = 3.0;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    if (isComplete) {
      pauseTimer += 0.016;
      if (pauseTimer > PAUSE_DURATION) {
        resetWFC();
      }
    } else {
      stepTimer += 0.016;
      // Collapse multiple cells per frame for speed
      const stepsPerFrame = 3;
      for (let s = 0; s < stepsPerFrame; s++) {
        if (!isComplete) stepWFC();
      }
    }

    // Fade flash effects back to normal
    for (let i = 0; i < GRID * GRID; i++) {
      if (collapsed[i] >= 0) {
        const tile = TILES[collapsed[i]];
        const c = tile.color;
        const mat = cellMaterials[i];
        mat.color.r += (c[0] - mat.color.r) * 0.1;
        mat.color.g += (c[1] - mat.color.g) * 0.1;
        mat.color.b += (c[2] - mat.color.b) * 0.1;
      }
    }

    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    renderer.setSize(w, h);
    const a = w / h;
    camera.left = -viewSize * a;
    camera.right = viewSize * a;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    renderer.setSize(w, h);
    const a = w / h;
    camera.left = -viewSize * a;
    camera.right = viewSize * a;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  return () => {
    running = false;
    window.removeEventListener('resize', onResize);
    cellGeo.dispose();
    cellMaterials.forEach(m => m.dispose());
    renderer.dispose();
  };
}
