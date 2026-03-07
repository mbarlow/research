// Audio spectrogram terrain — procedural spectrogram as 3D flythrough
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

const FREQ_BINS = 96;
const TIME_SLICES = 120;

// Procedural spectrogram generator — simulates evolving harmonics
function generateColumn(time) {
  const data = new Float32Array(FREQ_BINS);
  // Multiple harmonic peaks that drift
  const peaks = [
    { freq: 0.08, amp: 1.0, drift: 0.3, speed: 0.7 },
    { freq: 0.16, amp: 0.7, drift: 0.15, speed: 1.1 },
    { freq: 0.24, amp: 0.5, drift: 0.2, speed: 0.5 },
    { freq: 0.35, amp: 0.35, drift: 0.25, speed: 1.5 },
    { freq: 0.5, amp: 0.25, drift: 0.1, speed: 0.9 },
    { freq: 0.7, amp: 0.15, drift: 0.15, speed: 1.3 },
  ];

  for (let i = 0; i < FREQ_BINS; i++) {
    const f = i / FREQ_BINS;
    let val = 0;
    for (const p of peaks) {
      const center = p.freq + Math.sin(time * p.speed) * p.drift;
      const width = 0.015 + 0.01 * Math.sin(time * p.speed * 0.7);
      val += p.amp * Math.exp(-((f - center) ** 2) / (2 * width * width));
    }
    // Percussive hits
    const hitPhase = (time * 2.0) % 1.0;
    if (hitPhase < 0.05) {
      val += 0.4 * Math.exp(-f * 3.0) * (1.0 - hitPhase / 0.05);
    }
    // Background noise
    val += (Math.sin(f * 137.5 + time * 50) * 0.5 + 0.5) * 0.03;
    data[i] = Math.max(0, val);
  }
  return data;
}

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050510);
  scene.fog = new THREE.FogExp2(0x050510, 0.04);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);

  // Terrain geometry
  const terrainGeo = new THREE.PlaneGeometry(
    12, 24, FREQ_BINS - 1, TIME_SLICES - 1
  );
  terrainGeo.rotateX(-Math.PI / 2);

  // Vertex colors
  const vertCount = FREQ_BINS * TIME_SLICES;
  const colors = new Float32Array(vertCount * 3);
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    metalness: 0.3,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  scene.add(terrain);

  // Lights
  scene.add(new THREE.AmbientLight(0x223344, 0.4));
  const dirLight = new THREE.DirectionalLight(0xffeedd, 0.6);
  dirLight.position.set(2, 5, 3);
  scene.add(dirLight);
  const pointLight = new THREE.PointLight(0x4488ff, 1.0, 15);
  pointLight.position.set(0, 3, 0);
  scene.add(pointLight);

  // Scrolling spectrogram buffer
  const specBuffer = [];
  for (let t = 0; t < TIME_SLICES; t++) {
    specBuffer.push(new Float32Array(FREQ_BINS));
  }
  for (let t = 0; t < TIME_SLICES; t++) {
    const seededTime = (TIME_SLICES - t) * 0.05;
    specBuffer[t].set(generateColumn(seededTime));
  }

  // Color ramp
  function heightColor(val) {
    const r = Math.min(val * 2.0, 1.0) * 0.3 + val * val * 0.7;
    const g = Math.max(0, val - 0.2) * 1.2 * 0.7;
    const b = 0.15 + val * 0.5;
    return [
      Math.min(r, 1),
      Math.min(g, 1),
      Math.min(b, 1),
    ];
  }

  function updateTerrain() {
    const posAttr = terrainGeo.attributes.position;
    const colAttr = terrainGeo.attributes.color;

    for (let t = 0; t < TIME_SLICES; t++) {
      for (let f = 0; f < FREQ_BINS; f++) {
        const vi = t * FREQ_BINS + f;
        const val = specBuffer[t][f];
        const h = val * 3.0;
        posAttr.setY(vi, h);

        const [cr, cg, cb] = heightColor(val);
        colAttr.setXYZ(vi, cr, cg, cb);
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    terrainGeo.computeVertexNormals();
  }

  let running = true;
  let simTime = TIME_SLICES * 0.05;
  let scrollTimer = 0;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    simTime += 0.016;
    scrollTimer += 0.016;

    // Generate new spectrogram column periodically
    if (scrollTimer > 0.05) {
      scrollTimer = 0;
      // Shift rows
      for (let t = TIME_SLICES - 1; t > 0; t--) {
        specBuffer[t].set(specBuffer[t - 1]);
      }
      // Generate new front row
      specBuffer[0].set(generateColumn(simTime));
    }

    updateTerrain();

    // Move point light with the terrain
    pointLight.position.set(
      Math.sin(simTime * 0.3) * 3,
      3 + Math.sin(simTime * 0.5) * 1,
      Math.cos(simTime * 0.2) * 2
    );

    // Camera: fly through at a low angle
    const camZ = -8 + Math.sin(simTime * 0.1) * 2;
    const camX = Math.sin(simTime * 0.08) * 3;
    const camY = 3.0 + Math.sin(simTime * 0.15) * 1.0;
    camera.position.set(camX, camY, camZ);
    camera.lookAt(0, 0.5, 4);

    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  return () => {
    running = false;
    window.removeEventListener('resize', onResize);
    terrainGeo.dispose(); terrainMat.dispose();
    renderer.dispose();
  };
}
