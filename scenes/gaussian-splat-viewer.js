// Gaussian splat viewer scene
// Loads .splat files via GaussianSplats3D, auto-centers camera on data,
// adds grid + orbit controls for spatial context.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DEFAULT_SPLAT_PATH = 'media/gaussian-splats/output/train.splat';
const SPLAT_LIB_URL = 'https://cdn.jsdelivr.net/npm/@mkkellogg/gaussian-splats-3d@0.4.7/+esm';

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

function addStatusOverlay(container, message) {
  const el = document.createElement('div');
  el.className = 'scene-status';
  el.innerHTML = message;
  container.appendChild(el);
  return el;
}

function uniquePaths(paths) {
  const seen = new Set();
  return paths.filter((p) => {
    const key = String(p || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Sample splat positions to compute centroid and extent
function computeSplatBounds(viewer) {
  const mesh = viewer.splatMesh;
  if (!mesh) return null;
  const count = mesh.getSplatCount();
  if (count === 0) return null;

  const vec = new THREE.Vector3();
  vec.w = 0;
  let sumX = 0, sumY = 0, sumZ = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const step = Math.max(1, Math.floor(count / 2000));
  let n = 0;

  for (let i = 0; i < count; i += step) {
    mesh.getSplatCenter(i, vec);
    sumX += vec.x; sumY += vec.y; sumZ += vec.z;
    if (vec.x < minX) minX = vec.x; if (vec.y < minY) minY = vec.y; if (vec.z < minZ) minZ = vec.z;
    if (vec.x > maxX) maxX = vec.x; if (vec.y > maxY) maxY = vec.y; if (vec.z > maxZ) maxZ = vec.z;
    n++;
  }

  const centroid = new THREE.Vector3(sumX / n, sumY / n, sumZ / n);
  const extent = new THREE.Vector3(maxX - minX, maxY - minY, maxZ - minZ);
  const maxExtent = Math.max(extent.x, extent.y, extent.z);

  return { centroid, extent, maxExtent };
}

export async function init(canvas, container) {
  const splatPath = container.getAttribute('data-splat') || DEFAULT_SPLAT_PATH;
  const splatFallbackPath = container.getAttribute('data-splat-fallback') || DEFAULT_SPLAT_PATH;
  const loadPaths = uniquePaths([splatPath, splatFallbackPath, DEFAULT_SPLAT_PATH]);
  const overlay = addStatusOverlay(container, `
    <div>
      <strong>Loading splat...</strong><br>
      <code>${splatPath}</code>
    </div>
  `);

  // The markdown renderer creates a canvas pre-emptively; this scene uses Viewer-managed canvas.
  canvas.remove();

  let viewer = null;
  let orbitControls = null;
  let gridHelper = null;

  try {
    const GaussianSplats3D = await withTimeout(import(SPLAT_LIB_URL), 10000, 'Splat viewer library load');
    const Viewer = GaussianSplats3D.Viewer || GaussianSplats3D.default?.Viewer;
    if (!Viewer) {
      throw new Error('Viewer export not found in gaussian-splats-3d module.');
    }

    viewer = new Viewer({
      rootElement: container,
      cameraUp: [0, 1, 0],
      initialCameraPosition: [0, 2, 5],
      initialCameraLookAt: [0, 1, 0],
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort: false,
      useBuiltInControls: false,
      antialiased: true,
    });

    let loadedPath = null;
    let lastError = null;
    for (const path of loadPaths) {
      overlay.innerHTML = `
        <div>
          <strong>Loading splat...</strong><br>
          <code>${path}</code>
        </div>
      `;
      try {
        await withTimeout(
          viewer.addSplatScene(path, {
            progressiveLoad: true,
            showLoadingUI: false,
          }),
          30000,
          'Splat scene load'
        );
        loadedPath = path;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!loadedPath) {
      throw lastError || new Error('Could not load primary or fallback splat path.');
    }

    // Compute where the splat data actually is
    const bounds = computeSplatBounds(viewer);
    const centroid = bounds?.centroid || new THREE.Vector3(0, 1, 0);
    const maxExtent = bounds?.maxExtent || 3;
    const camDist = maxExtent * 1.8;

    console.log('[splat-viewer] centroid:', centroid.toArray().map(v => v.toFixed(2)));
    console.log('[splat-viewer] extent:', bounds?.extent?.toArray().map(v => v.toFixed(2)));

    // Position camera to look at centroid from a good angle
    viewer.camera.position.set(
      centroid.x + camDist * 0.6,
      centroid.y + camDist * 0.4,
      centroid.z + camDist * 0.7
    );
    viewer.camera.lookAt(centroid);

    // Add grid at the lowest Y of the splat data for ground reference
    const gridY = bounds ? bounds.centroid.y - bounds.extent.y * 0.6 : 0;
    const gridSize = Math.max(10, Math.ceil(maxExtent * 3));
    gridHelper = new THREE.GridHelper(gridSize, gridSize, 0x444466, 0x222244);
    gridHelper.position.y = gridY;
    viewer.threeScene.add(gridHelper);

    // Set up Three.js OrbitControls on the viewer's canvas
    const viewerCanvas = container.querySelector('canvas');
    if (viewerCanvas) {
      orbitControls = new OrbitControls(viewer.camera, viewerCanvas);
      orbitControls.target.copy(centroid);
      orbitControls.enableDamping = true;
      orbitControls.dampingFactor = 0.12;
      orbitControls.minDistance = maxExtent * 0.3;
      orbitControls.maxDistance = maxExtent * 8;
      orbitControls.update();

      // Drive OrbitControls updates from the viewer's render loop
      const origUpdate = viewer.update?.bind(viewer);
      const patchedUpdate = function () {
        if (orbitControls) orbitControls.update();
        if (origUpdate) return origUpdate();
      };
      if (viewer.update) viewer.update = patchedUpdate;
    }

    viewer.start();

    if (loadedPath !== splatPath) {
      overlay.innerHTML = `
        <div>
          <strong>Loaded fallback sample.</strong><br>
          <code>${loadedPath}</code>
        </div>
      `;
      setTimeout(() => overlay.remove(), 1800);
    } else {
      overlay.remove();
    }
  } catch (error) {
    overlay.innerHTML = `
      <div>
        <strong>Splat load failed.</strong><br>
        Primary file: <code>${splatPath}</code><br>
        ${splatFallbackPath ? `Fallback file: <code>${splatFallbackPath}</code><br>` : ''}
        Check file paths, then refresh.
      </div>
    `;
    console.warn('Gaussian splat viewer failed:', error);
  }

  return () => {
    if (orbitControls) orbitControls.dispose();
    if (gridHelper) {
      gridHelper.geometry?.dispose();
      gridHelper.material?.dispose();
    }
    if (viewer?.stop) viewer.stop();
    if (viewer?.dispose) viewer.dispose();
    if (overlay?.isConnected) overlay.remove();
  };
}
