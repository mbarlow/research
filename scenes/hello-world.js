// Three.js spinning cube demo scene
// Exports init(canvas, container) → cleanup function

import * as THREE from 'three';

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 400;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0, 4);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(5, 5, 5);
  scene.add(directional);

  // Cube
  const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const material = new THREE.MeshStandardMaterial({
    color: 0x7c8af8,
    metalness: 0.3,
    roughness: 0.4,
  });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  // Wireframe
  const wireGeo = new THREE.EdgesGeometry(geometry);
  const wireMat = new THREE.LineBasicMaterial({ color: 0xaab4ff, transparent: true, opacity: 0.3 });
  const wireframe = new THREE.LineSegments(wireGeo, wireMat);
  cube.add(wireframe);

  let running = true;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    cube.rotation.x += 0.005;
    cube.rotation.y += 0.008;
    renderer.render(scene, camera);
  }
  animate();

  // Resize handler
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight || 400;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  // Return cleanup function
  return () => {
    running = false;
    window.removeEventListener('resize', onResize);
    geometry.dispose();
    material.dispose();
    wireGeo.dispose();
    wireMat.dispose();
    renderer.dispose();
  };
}
