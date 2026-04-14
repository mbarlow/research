// PBR Material Ball Grid — metalness vs roughness parameter space
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

export function init(canvas, container, palette) {
  const hex = palette.as.hex;
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(hex.bg);
  scene.fog = new THREE.Fog(hex.bg, 12, 22);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 3.5, 10);

  // --- Procedural environment lighting ---
  // Multiple colored point lights from different directions simulate environment IBL

  const ambient = new THREE.AmbientLight(hex.elevated, 0.3);
  scene.add(ambient);

  // Hemisphere light for sky/ground gradient
  const hemi = new THREE.HemisphereLight(hex.hues[4], hex.hues[3], 0.6);
  scene.add(hemi);

  // Key light (warm)
  const keyLight = new THREE.DirectionalLight(hex.text, 1.2);
  keyLight.position.set(5, 6, 4);
  scene.add(keyLight);

  // Fill light (cool blue)
  const fillLight = new THREE.DirectionalLight(hex.hues[4], 0.5);
  fillLight.position.set(-5, 3, -2);
  scene.add(fillLight);

  // Rim light (strong accent)
  const rimLight = new THREE.PointLight(hex.accent, 0.8, 20);
  rimLight.position.set(-3, 5, -5);
  scene.add(rimLight);

  // Bottom bounce (subtle warm)
  const bounceLight = new THREE.PointLight(hex.elevated, 0.4, 15);
  bounceLight.position.set(0, -3, 2);
  scene.add(bounceLight);

  // Additional environment fill points
  const envPoints = [
    { color: hex.hues[4], intensity: 0.3, pos: [6, 1, -3] },
    { color: hex.hues[5], intensity: 0.25, pos: [-6, 4, 3] },
    { color: hex.hues[3], intensity: 0.2, pos: [0, 6, 0] },
  ];

  envPoints.forEach(({ color, intensity, pos }) => {
    const p = new THREE.PointLight(color, intensity, 18);
    p.position.set(pos[0], pos[1], pos[2]);
    scene.add(p);
  });

  // --- Sphere grid ---
  const gridSize = 5;
  const spacing = 1.6;
  const sphereRadius = 0.55;
  const sphereGeo = new THREE.SphereGeometry(sphereRadius, 64, 64);

  const spheres = [];
  const materials = [];

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const metalness = col / (gridSize - 1);
      const roughness = row / (gridSize - 1);

      const mat = new THREE.MeshStandardMaterial({
        color: hex.hues[2],
        metalness,
        roughness,
        envMapIntensity: 1.0,
      });
      materials.push(mat);

      const mesh = new THREE.Mesh(sphereGeo, mat);
      const x = (col - (gridSize - 1) / 2) * spacing;
      const y = ((gridSize - 1) / 2 - row) * spacing;
      mesh.position.set(x, y + 1.6, 0);
      scene.add(mesh);
      spheres.push(mesh);
    }
  }

  // --- Ground plane ---
  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat = new THREE.MeshStandardMaterial({
    color: hex.elevated,
    metalness: 0.0,
    roughness: 0.9,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.6;
  scene.add(ground);

  // --- Axis labels (using small text sprites) ---
  function makeLabel(text, position) {
    const cnv = document.createElement('canvas');
    cnv.width = 256;
    cnv.height = 64;
    const ctx = cnv.getContext('2d');
    ctx.fillStyle = '#8899aa';
    ctx.font = '28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const tex = new THREE.CanvasTexture(cnv);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8 });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.2, 0.55, 1);
    sprite.position.copy(position);
    return { sprite, texture: tex, material: spriteMat };
  }

  const labelData = [];

  // Metalness axis label (bottom)
  const metLabel = makeLabel('metalness \u2192', new THREE.Vector3(0, -1.7, 0));
  scene.add(metLabel.sprite);
  labelData.push(metLabel);

  // Roughness axis label (left side)
  const roughLabel = makeLabel('\u2190 roughness', new THREE.Vector3(-4.8, 1.6, 0));
  scene.add(roughLabel.sprite);
  labelData.push(roughLabel);

  // --- Subtle grid lines on ground ---
  const gridHelper = new THREE.GridHelper(16, 24, hex.border, hex.borderSubtle);
  gridHelper.position.y = -2.59;
  scene.add(gridHelper);

  // --- Camera orbit ---
  const clock = new THREE.Clock();
  let running = true;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();

    // Slow orbit
    const orbitRadius = 10;
    const orbitSpeed = 0.12;
    camera.position.x = Math.sin(t * orbitSpeed) * orbitRadius * 0.35;
    camera.position.z = orbitRadius * 0.85 + Math.cos(t * orbitSpeed) * orbitRadius * 0.15;
    camera.position.y = 3.0 + Math.sin(t * orbitSpeed * 0.7) * 0.8;
    camera.lookAt(0, 1.0, 0);

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
    sphereGeo.dispose();
    groundGeo.dispose();
    groundMat.dispose();
    materials.forEach((m) => m.dispose());
    labelData.forEach((l) => {
      l.texture.dispose();
      l.material.dispose();
    });
    renderer.dispose();
  };
}
