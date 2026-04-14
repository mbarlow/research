// Instancing-focused Three.js scene for rendering techniques post
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

export function init(canvas, container, palette) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;
  const hex = palette.as.hex;
  const accentHSL = {};
  new THREE.Color(hex.accent).getHSL(accentHSL);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(hex.bg, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(hex.bg, 6, 20);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 2.4, 8);

  const ambient = new THREE.AmbientLight(hex.text, 0.45);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(hex.text, 1.0);
  key.position.set(3, 4, 2);
  scene.add(key);

  const fill = new THREE.DirectionalLight(palette.as.hex.hues[4], 0.5);
  fill.position.set(-4, 2, -2);
  scene.add(fill);

  const count = 520;
  const geometry = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  const material = new THREE.MeshStandardMaterial({
    color: hex.accent,
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

    color.setHSL(accentHSL.h + (i / count) * 0.1 - 0.03, 0.65, 0.55 + (i / count) * 0.15);
    instanced.setColorAt(i, color);
  }

  scene.add(instanced);

  const grid = new THREE.GridHelper(14, 20, hex.border, hex.borderSubtle);
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
