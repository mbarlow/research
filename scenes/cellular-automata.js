// 3D Cellular Automata visualization — Game of Life on a grid rendered as instanced cubes
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

const GRID = 40;

// ─── Game of Life logic ──────────────────────────────────────────────────────
function createGrid() {
  const grid = new Uint8Array(GRID * GRID);
  return grid;
}

function seedGrid(grid) {
  // Random initial state with ~30% fill
  for (let i = 0; i < grid.length; i++) {
    grid[i] = Math.random() < 0.3 ? 1 : 0;
  }
}

function countNeighbors(grid, x, y) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = (x + dx + GRID) % GRID;
      const ny = (y + dy + GRID) % GRID;
      count += grid[ny * GRID + nx];
    }
  }
  return count;
}

function stepGrid(current, next) {
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const idx = y * GRID + x;
      const alive = current[idx];
      const neighbors = countNeighbors(current, x, y);

      if (alive) {
        next[idx] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
      } else {
        next[idx] = (neighbors === 3) ? 1 : 0;
      }
    }
  }
}

export function init(canvas, container, palette) {
  const hex = palette.as.hex;
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(hex.bg, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(hex.bg, 15, 45);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 25, 30);

  // Lighting
  scene.add(new THREE.AmbientLight(hex.text, 0.3));

  const key = new THREE.DirectionalLight(hex.text, 1.0);
  key.position.set(5, 10, 5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(hex.hues[4], 0.5);
  fill.position.set(-5, 5, -5);
  scene.add(fill);

  // Instanced mesh for alive cells
  const cellGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
  const cellMat = new THREE.MeshStandardMaterial({
    color: hex.hues[4],
    metalness: 0.4,
    roughness: 0.3,
    transparent: true,
    opacity: 0.9,
  });
  const maxInstances = GRID * GRID;
  const instancedMesh = new THREE.InstancedMesh(cellGeo, cellMat, maxInstances);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(instancedMesh);

  // History stack for 3D layering effect (show last N generations)
  const HISTORY_DEPTH = 12;
  const historyMeshes = [];

  for (let layer = 0; layer < HISTORY_DEPTH; layer++) {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.55 + layer * 0.02, 0.7, 0.3 + layer * 0.03),
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
      opacity: Math.max(0.05, 0.6 - layer * 0.05),
    });
    const mesh = new THREE.InstancedMesh(cellGeo, mat, maxInstances);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    historyMeshes.push({ mesh, mat, grid: createGrid() });
  }

  // Grid state
  let gridA = createGrid();
  let gridB = createGrid();
  seedGrid(gridA);

  const dummy = new THREE.Object3D();
  const halfGrid = GRID / 2;

  function updateInstances(mesh, grid, yOffset) {
    let count = 0;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (grid[y * GRID + x]) {
          dummy.position.set(x - halfGrid, yOffset, y - halfGrid);
          dummy.updateMatrix();
          mesh.setMatrixAt(count, dummy.matrix);
          count++;
        }
      }
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }

  const clock = new THREE.Clock();
  let running = true;
  let stepTimer = 0;
  let generation = 0;
  const STEP_INTERVAL = 0.2;

  // Stagnation detection — reseed if pattern stabilizes
  let lastAliveCount = 0;
  let stagnantFrames = 0;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const dt = clock.getDelta();
    const t = clock.getElapsedTime();

    stepTimer += dt;
    if (stepTimer >= STEP_INTERVAL) {
      stepTimer = 0;
      generation++;

      // Push current grid into history
      for (let i = HISTORY_DEPTH - 1; i > 0; i--) {
        historyMeshes[i].grid.set(historyMeshes[i - 1].grid);
      }
      historyMeshes[0].grid.set(gridA);

      // Step simulation
      stepGrid(gridA, gridB);
      [gridA, gridB] = [gridB, gridA];

      // Stagnation check
      let aliveCount = 0;
      for (let i = 0; i < gridA.length; i++) aliveCount += gridA[i];

      if (aliveCount === lastAliveCount) {
        stagnantFrames++;
      } else {
        stagnantFrames = 0;
      }
      lastAliveCount = aliveCount;

      // Reseed if stagnant or dead
      if (stagnantFrames > 30 || aliveCount === 0) {
        seedGrid(gridA);
        stagnantFrames = 0;
      }

      // Update current generation instances
      updateInstances(instancedMesh, gridA, 0);

      // Update history layers
      for (let i = 0; i < HISTORY_DEPTH; i++) {
        updateInstances(historyMeshes[i].mesh, historyMeshes[i].grid, -(i + 1) * 1.0);
      }
    }

    // Camera orbit
    camera.position.x = Math.sin(t * 0.15) * 28;
    camera.position.z = Math.cos(t * 0.15) * 28;
    camera.position.y = 15 + Math.sin(t * 0.1) * 8;
    camera.lookAt(0, -3, 0);

    renderer.render(scene, camera);
  }

  // Initial render
  updateInstances(instancedMesh, gridA, 0);
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
    cellGeo.dispose();
    cellMat.dispose();
    instancedMesh.dispose();
    historyMeshes.forEach(h => {
      h.mat.dispose();
      h.mesh.dispose();
    });
    renderer.dispose();
  };
}
