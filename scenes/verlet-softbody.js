// Verlet integration softbody physics — jelly, cloth, and rope
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class Particle {
  constructor(x, y, z, pinned = false) {
    this.pos = new THREE.Vector3(x, y, z);
    this.prev = new THREE.Vector3(x, y, z);
    this.pinned = pinned;
  }
}

class Constraint {
  constructor(p1, p2) {
    this.p1 = p1;
    this.p2 = p2;
    this.rest = p1.pos.distanceTo(p2.pos);
  }
}

function verletStep(particles, gravity, dt, damping) {
  for (const p of particles) {
    if (p.pinned) continue;
    const vx = (p.pos.x - p.prev.x) * damping;
    const vy = (p.pos.y - p.prev.y) * damping;
    const vz = (p.pos.z - p.prev.z) * damping;
    p.prev.copy(p.pos);
    p.pos.x += vx + gravity.x * dt * dt;
    p.pos.y += vy + gravity.y * dt * dt;
    p.pos.z += vz + gravity.z * dt * dt;
  }
}

function solveConstraints(constraints, iterations) {
  const diff = new THREE.Vector3();
  for (let iter = 0; iter < iterations; iter++) {
    for (const c of constraints) {
      diff.subVectors(c.p2.pos, c.p1.pos);
      const dist = diff.length();
      if (dist < 0.0001) continue;
      const correction = (dist - c.rest) / dist * 0.5;
      if (!c.p1.pinned) {
        c.p1.pos.x += diff.x * correction;
        c.p1.pos.y += diff.y * correction;
        c.p1.pos.z += diff.z * correction;
      }
      if (!c.p2.pinned) {
        c.p2.pos.x -= diff.x * correction;
        c.p2.pos.y -= diff.y * correction;
        c.p2.pos.z -= diff.z * correction;
      }
    }
  }
}

function floorCollision(particles, floorY) {
  for (const p of particles) {
    if (p.pinned) continue;
    if (p.pos.y < floorY) {
      p.pos.y = floorY;
      p.prev.y = p.pos.y + (p.pos.y - p.prev.y) * 0.3; // bounce
    }
  }
}

// Build cloth: grid of particles with structural + shear constraints
function buildCloth(ox, oy, oz, w, h, resX, resY) {
  const particles = [];
  const constraints = [];
  const spacing = w / resX;

  for (let y = 0; y <= resY; y++) {
    for (let x = 0; x <= resX; x++) {
      const pinned = y === 0 && (x % 4 === 0); // pin top row every 4th
      particles.push(new Particle(
        ox + x * spacing, oy - y * spacing, oz, pinned
      ));
    }
  }

  const cols = resX + 1;
  for (let y = 0; y <= resY; y++) {
    for (let x = 0; x <= resX; x++) {
      const i = y * cols + x;
      // Structural
      if (x < resX) constraints.push(new Constraint(particles[i], particles[i + 1]));
      if (y < resY) constraints.push(new Constraint(particles[i], particles[i + cols]));
      // Shear
      if (x < resX && y < resY) {
        constraints.push(new Constraint(particles[i], particles[i + cols + 1]));
        constraints.push(new Constraint(particles[i + 1], particles[i + cols]));
      }
    }
  }

  return { particles, constraints, resX: resX + 1, resY: resY + 1 };
}

// Build rope: chain of particles
function buildRope(ox, oy, oz, length, segments) {
  const particles = [];
  const constraints = [];
  const segLen = length / segments;

  for (let i = 0; i <= segments; i++) {
    const pinned = i === 0;
    particles.push(new Particle(ox, oy - i * segLen, oz, pinned));
  }

  for (let i = 0; i < segments; i++) {
    constraints.push(new Constraint(particles[i], particles[i + 1]));
  }

  return { particles, constraints };
}

// Build jelly cube: 3D grid with structural + diagonal constraints
function buildJelly(ox, oy, oz, size, res) {
  const particles = [];
  const constraints = [];
  const spacing = size / res;

  for (let z = 0; z <= res; z++) {
    for (let y = 0; y <= res; y++) {
      for (let x = 0; x <= res; x++) {
        particles.push(new Particle(
          ox + x * spacing - size / 2,
          oy + y * spacing,
          oz + z * spacing - size / 2
        ));
      }
    }
  }

  const sx = 1;
  const sy = (res + 1);
  const sz = (res + 1) * (res + 1);

  for (let z = 0; z <= res; z++) {
    for (let y = 0; y <= res; y++) {
      for (let x = 0; x <= res; x++) {
        const i = z * sz + y * sy + x;
        // Structural
        if (x < res) constraints.push(new Constraint(particles[i], particles[i + sx]));
        if (y < res) constraints.push(new Constraint(particles[i], particles[i + sy]));
        if (z < res) constraints.push(new Constraint(particles[i], particles[i + sz]));
        // Face diagonals (for rigidity)
        if (x < res && y < res) constraints.push(new Constraint(particles[i], particles[i + sx + sy]));
        if (y < res && z < res) constraints.push(new Constraint(particles[i], particles[i + sy + sz]));
        if (x < res && z < res) constraints.push(new Constraint(particles[i], particles[i + sx + sz]));
      }
    }
  }

  return { particles, constraints, res };
}

export function init(canvas, container, palette) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;
  const hex = palette.as.hex;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(hex.bg);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 50);
  camera.position.set(0, 2, 8);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  // Lights
  scene.add(new THREE.AmbientLight(hex.hues[4], 0.5));
  const dirLight = new THREE.DirectionalLight(hex.text, 0.8);
  dirLight.position.set(3, 5, 4);
  scene.add(dirLight);

  // Floor
  const floorGeo = new THREE.PlaneGeometry(20, 20, 20, 20);
  const floorMat = new THREE.MeshStandardMaterial({
    color: hex.elevated,
    roughness: 0.9,
    wireframe: false,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  scene.add(floor);

  const FLOOR_Y = -2;
  const gravity = new THREE.Vector3(0, -15, 0);
  const dt = 0.012;
  const damping = 0.995;
  const constraintIters = 6;

  // Build objects
  // Cloth (center)
  const cloth = buildCloth(-1.5, 2.5, 0, 3, 3, 18, 18);
  const clothGeo = new THREE.PlaneGeometry(3, 3, 18, 18);
  const clothMat = new THREE.MeshStandardMaterial({
    color: hex.hues[4],
    side: THREE.DoubleSide,
    roughness: 0.7,
    metalness: 0.1,
  });
  const clothMesh = new THREE.Mesh(clothGeo, clothMat);
  scene.add(clothMesh);

  // Rope (right)
  const rope = buildRope(3.5, 2.5, 0, 4, 28);
  const ropeCurve = new THREE.CatmullRomCurve3(rope.particles.map(p => p.pos.clone()));
  let ropeGeo = new THREE.TubeGeometry(ropeCurve, 28, 0.04, 6, false);
  const ropeMat = new THREE.MeshStandardMaterial({
    color: hex.accent,
    roughness: 0.6,
    metalness: 0.3,
  });
  let ropeMesh = new THREE.Mesh(ropeGeo, ropeMat);
  scene.add(ropeMesh);

  // Jelly (left)
  const jelly = buildJelly(-3.5, 1.0, 0, 1.2, 4);
  const jellyGeo = new THREE.BufferGeometry();
  const jellyPositions = new Float32Array(jelly.particles.length * 3);
  jellyGeo.setAttribute('position', new THREE.BufferAttribute(jellyPositions, 3));

  const jellyMat = new THREE.PointsMaterial({
    color: hex.hues[3],
    size: 0.1,
    transparent: true,
    opacity: 0.8,
  });
  const jellyPoints = new THREE.Points(jellyGeo, jellyMat);
  scene.add(jellyPoints);

  // Jelly wireframe from constraints
  const jellyLinePositions = new Float32Array(jelly.constraints.length * 6);
  const jellyLineGeo = new THREE.BufferGeometry();
  jellyLineGeo.setAttribute('position', new THREE.BufferAttribute(jellyLinePositions, 3));
  const jellyLineMat = new THREE.LineBasicMaterial({
    color: hex.hues[3],
    transparent: true,
    opacity: 0.15,
  });
  const jellyLines = new THREE.LineSegments(jellyLineGeo, jellyLineMat);
  scene.add(jellyLines);

  let running = true;
  const clock = new THREE.Clock();
  let time = 0;
  let jellyLaunchTimer = 0;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const elapsed = clock.getDelta();
    time += elapsed;
    controls.update();

    // Wind force on cloth and rope
    const windX = Math.sin(time * 1.5) * 4;
    const windZ = Math.cos(time * 1.1) * 3;
    const windForce = new THREE.Vector3(windX, 0, windZ);

    // Substeps for stability
    const substeps = 3;
    for (let sub = 0; sub < substeps; sub++) {
      // Cloth physics
      verletStep(cloth.particles, gravity, dt / substeps, damping);
      // Apply wind to cloth
      for (const p of cloth.particles) {
        if (!p.pinned) {
          p.pos.x += windForce.x * (dt / substeps) * (dt / substeps) * 0.5;
          p.pos.z += windForce.z * (dt / substeps) * (dt / substeps) * 0.5;
        }
      }
      solveConstraints(cloth.constraints, constraintIters);
      floorCollision(cloth.particles, FLOOR_Y);

      // Rope physics
      verletStep(rope.particles, gravity, dt / substeps, damping);
      for (const p of rope.particles) {
        if (!p.pinned) {
          p.pos.x += windForce.x * (dt / substeps) * (dt / substeps) * 0.3;
          p.pos.z += windForce.z * (dt / substeps) * (dt / substeps) * 0.3;
        }
      }
      solveConstraints(rope.constraints, constraintIters);
      floorCollision(rope.particles, FLOOR_Y);

      // Jelly physics
      verletStep(jelly.particles, gravity, dt / substeps, damping);
      solveConstraints(jelly.constraints, constraintIters);
      floorCollision(jelly.particles, FLOOR_Y);
    }

    // Periodically launch jelly upward
    jellyLaunchTimer += elapsed;
    if (jellyLaunchTimer > 5.0) {
      jellyLaunchTimer = 0;
      for (const p of jelly.particles) {
        p.prev.y -= 0.3; // impulse upward
        p.prev.x -= (Math.random() - 0.5) * 0.1;
      }
    }

    // Update cloth mesh
    const clothPos = clothGeo.attributes.position;
    for (let i = 0; i < cloth.particles.length; i++) {
      clothPos.setXYZ(i, cloth.particles[i].pos.x, cloth.particles[i].pos.y, cloth.particles[i].pos.z);
    }
    clothPos.needsUpdate = true;
    clothGeo.computeVertexNormals();
    clothMesh.geometry = clothGeo;

    // Update rope mesh
    scene.remove(ropeMesh);
    ropeGeo.dispose();
    const points = rope.particles.map(p => p.pos.clone());
    const curve = new THREE.CatmullRomCurve3(points);
    ropeGeo = new THREE.TubeGeometry(curve, 28, 0.04, 6, false);
    ropeMesh = new THREE.Mesh(ropeGeo, ropeMat);
    scene.add(ropeMesh);

    // Update jelly points
    for (let i = 0; i < jelly.particles.length; i++) {
      jellyPositions[i * 3] = jelly.particles[i].pos.x;
      jellyPositions[i * 3 + 1] = jelly.particles[i].pos.y;
      jellyPositions[i * 3 + 2] = jelly.particles[i].pos.z;
    }
    jellyGeo.attributes.position.needsUpdate = true;

    // Update jelly lines
    for (let i = 0; i < jelly.constraints.length; i++) {
      const c = jelly.constraints[i];
      jellyLinePositions[i * 6] = c.p1.pos.x;
      jellyLinePositions[i * 6 + 1] = c.p1.pos.y;
      jellyLinePositions[i * 6 + 2] = c.p1.pos.z;
      jellyLinePositions[i * 6 + 3] = c.p2.pos.x;
      jellyLinePositions[i * 6 + 4] = c.p2.pos.y;
      jellyLinePositions[i * 6 + 5] = c.p2.pos.z;
    }
    jellyLineGeo.attributes.position.needsUpdate = true;

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
    controls.dispose();
    clothGeo.dispose(); clothMat.dispose();
    ropeGeo.dispose(); ropeMat.dispose();
    jellyGeo.dispose(); jellyMat.dispose();
    jellyLineGeo.dispose(); jellyLineMat.dispose();
    floorGeo.dispose(); floorMat.dispose();
    renderer.dispose();
  };
}
