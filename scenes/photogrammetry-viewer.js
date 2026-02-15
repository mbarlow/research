// Photogrammetry OBJ model viewer
// Loads OBJ + MTL with textures, auto-centers, orbit controls

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

const DEFAULT_MODEL_PATH = 'media/photogrammetry/';

function addStatusOverlay(container, message) {
  const el = document.createElement('div');
  el.className = 'scene-status';
  el.innerHTML = message;
  container.appendChild(el);
  return el;
}

export async function init(canvas, container) {
  const modelPath = container.getAttribute('data-model-path') || DEFAULT_MODEL_PATH;
  const overlay = addStatusOverlay(container, '<div><strong>Loading model...</strong></div>');

  const width = container.clientWidth;
  const height = container.clientHeight || 500;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 100);
  camera.position.set(0, 1, 3);

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0xc8d8e8, 0x444422, 1.0);
  scene.add(hemiLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight1.position.set(3, 5, 4);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0xddeeff, 0.4);
  dirLight2.position.set(-2, 3, -3);
  scene.add(dirLight2);

  // Grid
  const gridHelper = new THREE.GridHelper(4, 20, 0x444466, 0x222244);
  scene.add(gridHelper);

  // Orbit controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.target.set(0, 0, 0);

  let running = true;
  let loadedObject = null;

  try {
    // Load MTL
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath(modelPath);
    const materials = await new Promise((resolve, reject) => {
      mtlLoader.load('texturedMesh.mtl', resolve, undefined, reject);
    });
    materials.preload();

    overlay.innerHTML = '<div><strong>Loading mesh...</strong></div>';

    // Load OBJ with materials
    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);
    objLoader.setPath(modelPath);
    loadedObject = await new Promise((resolve, reject) => {
      objLoader.load('texturedMesh.obj', resolve, undefined, reject);
    });

    // Auto-center and scale
    const box = new THREE.Box3().setFromObject(loadedObject);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2.0 / maxDim;

    loadedObject.position.sub(center);
    loadedObject.scale.setScalar(scale);
    scene.add(loadedObject);

    // Position camera to frame the object
    const camDist = 2.5;
    camera.position.set(camDist * 0.6, camDist * 0.4, camDist * 0.8);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();

    overlay.remove();
  } catch (error) {
    overlay.innerHTML = `
      <div>
        <strong>Model load failed.</strong><br>
        Path: <code>${modelPath}</code><br>
        ${error.message}
      </div>
    `;
    console.warn('Photogrammetry viewer failed:', error);
  }

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight || 500;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  return () => {
    running = false;
    window.removeEventListener('resize', onResize);
    controls.dispose();
    gridHelper.geometry?.dispose();
    gridHelper.material?.dispose();
    if (loadedObject) {
      loadedObject.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => {
              m.map?.dispose();
              m.dispose();
            });
          } else {
            child.material.map?.dispose();
            child.material.dispose();
          }
        }
      });
    }
    renderer.dispose();
  };
}
