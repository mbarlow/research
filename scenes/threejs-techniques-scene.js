// Instancing-focused Three.js scene for rendering techniques post
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0f1220, 6, 20);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 2.4, 8);

  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(3, 4, 2);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
  fill.position.set(-4, 2, -2);
  scene.add(fill);

  const count = 520;
  const geometry = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  const material = new THREE.MeshStandardMaterial({
    color: 0x8fb7ff,
    metalness: 0.15,
    roughness: 0.45,
  });

  const instanced = new THREE.InstancedMesh(geometry, material, count);
  instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 10;
    const r = 1.0 + (i / count) * 2.5;
    const y = -1.8 + (i / count) * 3.6;

    dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    dummy.rotation.set(a * 0.3, a * 0.6, 0);
    const s = 0.7 + ((i % 9) / 9) * 0.8;
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    instanced.setMatrixAt(i, dummy.matrix);

    color.setHSL(0.58 + (i / count) * 0.08, 0.7, 0.62);
    instanced.setColorAt(i, color);
  }

  scene.add(instanced);

  const grid = new THREE.GridHelper(14, 20, 0x334466, 0x223344);
  grid.position.y = -2.1;
  scene.add(grid);

  const clock = new THREE.Clock();
  let running = true;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();
    const dt = Math.min(clock.getDelta(), 1 / 30);

    instanced.rotation.y += dt * 0.16;
    camera.position.x = Math.sin(t * 0.24) * 1.8;
    camera.position.z = 8 + Math.cos(t * 0.17) * 0.9;
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
