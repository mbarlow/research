// Modal analysis — strike 3D shapes to hear their resonant frequencies
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const SHAPES = [
  {
    name: 'Cube',
    geometry: () => new THREE.BoxGeometry(0.8, 0.8, 0.8, 4, 4, 4),
    baseFreq: 220,
    ratios: [1.0, 1.58, 2.0, 2.24, 2.92, 3.16],
    decays: [2.0, 1.5, 1.2, 1.0, 0.8, 0.6],
    color: hex.accent,
  },
  {
    name: 'Sphere',
    geometry: () => new THREE.SphereGeometry(0.5, 24, 16),
    baseFreq: 330,
    ratios: [1.0, 1.47, 2.09, 2.56, 3.14],
    decays: [2.5, 2.0, 1.5, 1.2, 0.9],
    color: hex.hues[3],
  },
  {
    name: 'Cylinder',
    geometry: () => new THREE.CylinderGeometry(0.35, 0.35, 1.0, 24),
    baseFreq: 180,
    ratios: [1.0, 2.76, 5.40, 8.93, 13.34],
    decays: [3.0, 2.0, 1.2, 0.8, 0.5],
    color: hex.hues[4],
  },
  {
    name: 'Torus',
    geometry: () => new THREE.TorusGeometry(0.4, 0.15, 16, 32),
    baseFreq: 260,
    ratios: [1.0, 1.73, 2.83, 3.46, 4.58],
    decays: [2.2, 1.8, 1.3, 1.0, 0.7],
    color: hex.hues[1],
  },
  {
    name: 'Cone',
    geometry: () => new THREE.ConeGeometry(0.45, 1.0, 24),
    baseFreq: 150,
    ratios: [1.0, 1.34, 1.83, 2.0, 2.56],
    decays: [1.8, 1.5, 1.2, 1.0, 0.8],
    color: hex.hues[2],
  },
];

function strikeSound(audioCtx, baseFreq, ratios, decays) {
  const now = audioCtx.currentTime;
  const master = audioCtx.createGain();
  master.gain.value = 0.15;
  master.connect(audioCtx.destination);

  ratios.forEach((ratio, i) => {
    const freq = baseFreq * ratio;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.frequency.value = freq;
    osc.type = 'sine';

    const amp = 0.5 / (i + 1);
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + decays[i] + 0.1);
  });

  // Add a soft noise burst for the attack
  const bufferSize = audioCtx.sampleRate * 0.05;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noiseSrc = audioCtx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.08, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = baseFreq * 2;
  noiseFilter.Q.value = 1.0;
  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noiseSrc.start(now);
}

export function init(canvas, container, palette) {
  const hex = palette.as.hex;
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(hex.bg);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
  camera.position.set(0, 2, 7);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.maxPolarAngle = Math.PI * 0.7;

  // Lights
  const ambient = new THREE.AmbientLight(hex.border, 0.8);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(hex.text, 1.2);
  dirLight.position.set(3, 5, 4);
  scene.add(dirLight);
  const rimLight = new THREE.DirectionalLight(hex.hues[4], 0.5);
  rimLight.position.set(-3, 2, -3);
  scene.add(rimLight);

  // Floor
  const floorGeo = new THREE.PlaneGeometry(20, 20);
  const floorMat = new THREE.MeshStandardMaterial({ color: hex.elevated, roughness: 0.9, metalness: 0.0 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.2;
  scene.add(floor);

  // Create shape meshes
  const meshes = [];
  const strikeStates = [];
  const spacing = 2.2;
  const startX = -(SHAPES.length - 1) * spacing * 0.5;

  SHAPES.forEach((shape, i) => {
    const geo = shape.geometry();
    const mat = new THREE.MeshStandardMaterial({
      color: shape.color,
      roughness: 0.3,
      metalness: 0.7,
      emissive: 0x000000,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(startX + i * spacing, 0, 0);
    mesh.userData = { shapeIndex: i };
    scene.add(mesh);
    meshes.push(mesh);
    strikeStates.push({ active: false, time: 0 });
  });

  // Raycaster for click detection
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let audioCtx = null;

  function onClick(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(meshes);

    if (hits.length > 0) {
      const idx = hits[0].object.userData.shapeIndex;

      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }

      const shape = SHAPES[idx];
      strikeSound(audioCtx, shape.baseFreq, shape.ratios, shape.decays);
      strikeStates[idx].active = true;
      strikeStates[idx].time = 0;
    }
  }
  canvas.addEventListener('click', onClick);

  let running = true;
  const clock = new THREE.Clock();

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const dt = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    controls.update();

    // Animate strike feedback
    meshes.forEach((mesh, i) => {
      const state = strikeStates[i];
      if (state.active) {
        state.time += dt;
        const t = state.time;
        const pulse = Math.exp(-t * 4.0) * Math.sin(t * 30) * 0.1;
        mesh.scale.setScalar(1.0 + Math.max(0, pulse));

        const glow = Math.exp(-t * 3.0) * 0.4;
        mesh.material.emissive.setRGB(glow, glow * 0.7, glow * 0.3);

        if (t > 2.0) {
          state.active = false;
          mesh.scale.setScalar(1.0);
          mesh.material.emissive.setRGB(0, 0, 0);
        }
      }

      // Gentle float animation
      mesh.position.y = Math.sin(elapsed * 0.5 + i * 1.2) * 0.08;
      mesh.rotation.y = elapsed * 0.15 + i * 0.5;
    });

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
    canvas.removeEventListener('click', onClick);
    window.removeEventListener('resize', onResize);
    if (audioCtx) audioCtx.close();
    controls.dispose();
    meshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
    floorGeo.dispose(); floorMat.dispose();
    renderer.dispose();
  };
}
