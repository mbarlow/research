// L-System procedural tree rendered with Three.js line segments and cylinders
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

// ─── L-System string rewriting ──────────────────────────────────────────────
function rewrite(axiom, rules, iterations) {
  let current = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const ch of current) {
      next += rules[ch] || ch;
    }
    current = next;
  }
  return current;
}

// ─── Turtle interpreter: string → line segments ────────────────────────────
function interpret(str, angle, stepLen) {
  const segments = [];
  const stack = [];

  let x = 0, y = 0, z = 0;
  let dir = new THREE.Vector3(0, 1, 0);
  let right = new THREE.Vector3(1, 0, 0);
  let up = new THREE.Vector3(0, 0, 1);
  let depth = 0;

  for (const ch of str) {
    switch (ch) {
      case 'F':
      case 'G': {
        const nx = x + dir.x * stepLen;
        const ny = y + dir.y * stepLen;
        const nz = z + dir.z * stepLen;
        segments.push({ x1: x, y1: y, z1: z, x2: nx, y2: ny, z2: nz, depth });
        x = nx; y = ny; z = nz;
        break;
      }
      case '+': { // Rotate around up axis (yaw left)
        const q = new THREE.Quaternion().setFromAxisAngle(up, angle);
        dir.applyQuaternion(q);
        right.applyQuaternion(q);
        break;
      }
      case '-': { // Rotate around up axis (yaw right)
        const q = new THREE.Quaternion().setFromAxisAngle(up, -angle);
        dir.applyQuaternion(q);
        right.applyQuaternion(q);
        break;
      }
      case '&': { // Pitch down
        const q = new THREE.Quaternion().setFromAxisAngle(right, angle);
        dir.applyQuaternion(q);
        up.applyQuaternion(q);
        break;
      }
      case '^': { // Pitch up
        const q = new THREE.Quaternion().setFromAxisAngle(right, -angle);
        dir.applyQuaternion(q);
        up.applyQuaternion(q);
        break;
      }
      case '\\': { // Roll left
        const q = new THREE.Quaternion().setFromAxisAngle(dir, angle);
        right.applyQuaternion(q);
        up.applyQuaternion(q);
        break;
      }
      case '/': { // Roll right
        const q = new THREE.Quaternion().setFromAxisAngle(dir, -angle);
        right.applyQuaternion(q);
        up.applyQuaternion(q);
        break;
      }
      case '[': {
        stack.push({
          x, y, z,
          dir: dir.clone(),
          right: right.clone(),
          up: up.clone(),
          depth,
        });
        depth++;
        break;
      }
      case ']': {
        const s = stack.pop();
        if (s) {
          x = s.x; y = s.y; z = s.z;
          dir = s.dir;
          right = s.right;
          up = s.up;
          depth = s.depth;
        }
        break;
      }
    }
  }

  return segments;
}

// ─── Build geometry from segments ───────────────────────────────────────────
function buildTreeGeometry(segments, maxDepth) {
  const positions = [];
  const colors = [];

  // Trunk color → leaf color gradient based on depth
  const trunkColor = new THREE.Color(0.35, 0.22, 0.1);
  const leafColor = new THREE.Color(0.15, 0.55, 0.15);
  const tipColor = new THREE.Color(0.3, 0.7, 0.2);

  for (const seg of segments) {
    positions.push(seg.x1, seg.y1, seg.z1);
    positions.push(seg.x2, seg.y2, seg.z2);

    const t = seg.depth / Math.max(maxDepth, 1);
    const col = t < 0.5
      ? trunkColor.clone().lerp(leafColor, t * 2)
      : leafColor.clone().lerp(tipColor, (t - 0.5) * 2);

    colors.push(col.r, col.g, col.b);
    colors.push(col.r, col.g, col.b);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// ─── Predefined L-System rulesets ───────────────────────────────────────────
const PRESETS = [
  {
    name: 'Sympodial Tree',
    axiom: 'F',
    rules: { F: 'FF[+F][-F][&F][^F]' },
    angle: Math.PI / 7,
    iterations: 5,
    stepLen: 0.12,
  },
  {
    name: 'Bush',
    axiom: 'F',
    rules: { F: 'F[+F]F[-F][F]' },
    angle: Math.PI / 7.5,
    iterations: 5,
    stepLen: 0.08,
  },
  {
    name: '3D Fern',
    axiom: 'F',
    rules: { F: 'FF&[+F^F][\\F^F]' },
    angle: Math.PI / 8,
    iterations: 5,
    stepLen: 0.1,
  },
];

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0e1a, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0e1a, 0.08);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 3, 8);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(3, 5, 4);
  scene.add(key);

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  scene.add(ground);

  // Tree group
  const treeGroup = new THREE.Group();
  scene.add(treeGroup);

  let currentGeometry = null;
  let currentLines = null;
  let currentPreset = 0;

  function buildTree(presetIdx) {
    const preset = PRESETS[presetIdx];
    const str = rewrite(preset.axiom, preset.rules, preset.iterations);
    const segments = interpret(str, preset.angle, preset.stepLen);
    const maxDepth = segments.reduce((m, s) => Math.max(m, s.depth), 0);

    if (currentLines) {
      treeGroup.remove(currentLines);
      currentGeometry.dispose();
    }

    currentGeometry = buildTreeGeometry(segments, maxDepth);
    const material = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 1 });
    currentLines = new THREE.LineSegments(currentGeometry, material);
    treeGroup.add(currentLines);

    // Center tree
    currentGeometry.computeBoundingBox();
    const box = currentGeometry.boundingBox;
    const centerY = (box.max.y + box.min.y) / 2;
    currentLines.position.y = -box.min.y;
  }

  buildTree(0);

  const clock = new THREE.Clock();
  let running = true;
  let switchTimer = 0;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const dt = clock.getDelta();
    const t = clock.getElapsedTime();

    // Switch presets every 8 seconds
    switchTimer += dt;
    if (switchTimer > 8.0) {
      switchTimer = 0;
      currentPreset = (currentPreset + 1) % PRESETS.length;
      buildTree(currentPreset);
    }

    // Orbit camera
    camera.position.x = Math.sin(t * 0.2) * 7;
    camera.position.z = Math.cos(t * 0.2) * 7;
    camera.position.y = 3 + Math.sin(t * 0.15) * 1.0;
    camera.lookAt(0, 2, 0);

    // Gentle rotation
    treeGroup.rotation.y = Math.sin(t * 0.1) * 0.3;

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
    if (currentGeometry) currentGeometry.dispose();
    groundGeo.dispose();
    groundMat.dispose();
    renderer.dispose();
  };
}
