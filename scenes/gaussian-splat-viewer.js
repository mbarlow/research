// Gaussian splat viewer scene
// Uses GaussianSplats3D's own render loop and controls for stability.

const DEFAULT_SPLAT_PATH = 'media/gaussian-splats/output/train.splat';
const SPLAT_LIB_URL = 'https://cdn.jsdelivr.net/npm/@mkkellogg/gaussian-splats-3d@0.4.7/+esm';

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
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

  try {
    const GaussianSplats3D = await withTimeout(import(SPLAT_LIB_URL), 10000, 'Splat viewer library load');
    const Viewer = GaussianSplats3D.Viewer || GaussianSplats3D.default?.Viewer;
    if (!Viewer) {
      throw new Error('Viewer export not found in gaussian-splats-3d module.');
    }

    viewer = new Viewer({
      rootElement: container,
      cameraUp: [0, 1, 0],
      initialCameraPosition: [1.7, 1.2, 1.9],
      initialCameraLookAt: [0, 0, 0],
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort: true,
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
          20000,
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
    if (viewer?.stop) viewer.stop();
    if (viewer?.dispose) viewer.dispose();
    if (overlay?.isConnected) overlay.remove();
  };
}
