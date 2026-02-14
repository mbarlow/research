// Gaussian-like point cloud demo scene
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

function gaussianRandom() {
  // Box-Muller transform for a normal distribution
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
  camera.position.set(0, 0, 6);

  const pointsCount = 2600;
  const positions = new Float32Array(pointsCount * 3);
  const colors = new Float32Array(pointsCount * 3);

  const colorA = new THREE.Color(0x7ed8ff);
  const colorB = new THREE.Color(0xd8a3ff);
  const tmp = new THREE.Color();

  for (let i = 0; i < pointsCount; i++) {
    const i3 = i * 3;

    // Elliptical gaussian cloud
    positions[i3] = gaussianRandom() * 1.1;
    positions[i3 + 1] = gaussianRandom() * 0.7;
    positions[i3 + 2] = gaussianRandom() * 1.5;

    const t = Math.min(1, Math.max(0, (positions[i3 + 2] + 3) / 6));
    tmp.copy(colorA).lerp(colorB, t);
    colors[i3] = tmp.r;
    colors[i3 + 1] = tmp.g;
    colors[i3 + 2] = tmp.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.07,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const cloud = new THREE.Points(geometry, material);
  scene.add(cloud);

  const clock = new THREE.Clock();
  let running = true;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();
    cloud.rotation.y = t * 0.12;
    cloud.rotation.x = Math.sin(t * 0.4) * 0.08;
    camera.position.x = Math.sin(t * 0.18) * 0.6;
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
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
