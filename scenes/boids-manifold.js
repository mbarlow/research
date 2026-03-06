// Boids on curved manifolds — flocking on a torus surface
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

const NUM_BOIDS = 250;
const R = 2.0; // major radius
const r = 0.8; // minor radius
const TAU = Math.PI * 2;

function torusPoint(u, v) {
  const cu = Math.cos(u), su = Math.sin(u);
  const cv = Math.cos(v), sv = Math.sin(v);
  return new THREE.Vector3(
    (R + r * cv) * cu,
    r * sv,
    (R + r * cv) * su
  );
}

function torusTangentU(u, v) {
  const cu = Math.cos(u), su = Math.sin(u);
  const cv = Math.cos(v);
  return new THREE.Vector3(
    -(R + r * cv) * su,
    0,
    (R + r * cv) * cu
  ).normalize();
}

function torusTangentV(u, v) {
  const cu = Math.cos(u), su = Math.sin(u);
  const cv = Math.cos(v), sv = Math.sin(v);
  return new THREE.Vector3(
    -r * sv * cu,
    r * cv,
    -r * sv * su
  ).normalize();
}

// Wrapped distance on torus parameter space
function wrapDist(a, b) {
  let d = b - a;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function geodesicDist(u1, v1, u2, v2) {
  const du = wrapDist(u1, u2);
  const dv = wrapDist(v1, v2);
  return Math.sqrt((R * du) ** 2 + (r * dv) ** 2);
}

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080810);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 50);
  camera.position.set(0, 3, 6);

  // Lights
  scene.add(new THREE.AmbientLight(0x334455, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
  dirLight.position.set(3, 5, 4);
  scene.add(dirLight);

  // Torus wireframe
  const torusGeo = new THREE.TorusGeometry(R, r, 32, 64);
  const torusMat = new THREE.MeshStandardMaterial({
    color: 0x334455,
    wireframe: true,
    transparent: true,
    opacity: 0.15,
  });
  const torusMesh = new THREE.Mesh(torusGeo, torusMat);
  scene.add(torusMesh);

  // Solid torus (very transparent) for depth
  const torusSolidMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    transparent: true,
    opacity: 0.3,
    roughness: 0.8,
    metalness: 0.2,
  });
  const torusSolid = new THREE.Mesh(torusGeo, torusSolidMat);
  scene.add(torusSolid);

  // Boid instanced mesh
  const boidGeo = new THREE.ConeGeometry(0.04, 0.12, 4);
  boidGeo.rotateX(Math.PI / 2);
  const boidMat = new THREE.MeshStandardMaterial({
    vertexColors: false,
    roughness: 0.3,
    metalness: 0.5,
  });
  const boidMesh = new THREE.InstancedMesh(boidGeo, boidMat, NUM_BOIDS);
  boidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // Per-instance colors
  const boidColors = new Float32Array(NUM_BOIDS * 3);
  for (let i = 0; i < NUM_BOIDS; i++) {
    const hue = (i / NUM_BOIDS + Math.random() * 0.1) % 1.0;
    const col = new THREE.Color().setHSL(hue, 0.7, 0.6);
    boidColors[i * 3] = col.r;
    boidColors[i * 3 + 1] = col.g;
    boidColors[i * 3 + 2] = col.b;
  }
  boidMesh.instanceColor = new THREE.InstancedBufferAttribute(boidColors, 3);
  scene.add(boidMesh);

  // Boid state: (u, v) position and (du, dv) velocity in parameter space
  const bu = new Float32Array(NUM_BOIDS);
  const bv = new Float32Array(NUM_BOIDS);
  const bdu = new Float32Array(NUM_BOIDS);
  const bdv = new Float32Array(NUM_BOIDS);

  for (let i = 0; i < NUM_BOIDS; i++) {
    bu[i] = Math.random() * TAU;
    bv[i] = Math.random() * TAU;
    bdu[i] = (Math.random() - 0.5) * 0.5;
    bdv[i] = (Math.random() - 0.5) * 0.5;
  }

  const PERCEPTION = 0.9;
  const MAX_SPEED = 1.2;
  const SEP_WEIGHT = 2.0;
  const ALI_WEIGHT = 1.0;
  const COH_WEIGHT = 1.0;

  const dummy = new THREE.Object3D();

  function updateBoids(dt) {
    for (let i = 0; i < NUM_BOIDS; i++) {
      let sepU = 0, sepV = 0;
      let aliU = 0, aliV = 0;
      let cohU = 0, cohV = 0;
      let neighbors = 0;

      for (let j = 0; j < NUM_BOIDS; j++) {
        if (i === j) continue;
        const dist = geodesicDist(bu[i], bv[i], bu[j], bv[j]);
        if (dist < PERCEPTION && dist > 0.001) {
          const du = wrapDist(bu[i], bu[j]);
          const dv = wrapDist(bv[i], bv[j]);

          // Separation
          const repel = 1.0 / (dist * dist + 0.01);
          sepU -= du * repel;
          sepV -= dv * repel;

          // Alignment
          aliU += bdu[j];
          aliV += bdv[j];

          // Cohesion
          cohU += du;
          cohV += dv;

          neighbors++;
        }
      }

      if (neighbors > 0) {
        aliU /= neighbors;
        aliV /= neighbors;
        cohU /= neighbors;
        cohV /= neighbors;

        bdu[i] += sepU * SEP_WEIGHT * dt;
        bdv[i] += sepV * SEP_WEIGHT * dt;
        bdu[i] += (aliU - bdu[i]) * ALI_WEIGHT * dt;
        bdv[i] += (aliV - bdv[i]) * ALI_WEIGHT * dt;
        bdu[i] += cohU * COH_WEIGHT * dt;
        bdv[i] += cohV * COH_WEIGHT * dt;
      }

      // Clamp speed
      const speed = Math.sqrt(bdu[i] ** 2 + bdv[i] ** 2);
      if (speed > MAX_SPEED) {
        bdu[i] = (bdu[i] / speed) * MAX_SPEED;
        bdv[i] = (bdv[i] / speed) * MAX_SPEED;
      }
      // Minimum speed
      if (speed < 0.2) {
        bdu[i] += (Math.random() - 0.5) * 0.3;
        bdv[i] += (Math.random() - 0.5) * 0.3;
      }

      // Update position (wrap)
      bu[i] = ((bu[i] + bdu[i] * dt) % TAU + TAU) % TAU;
      bv[i] = ((bv[i] + bdv[i] * dt) % TAU + TAU) % TAU;
    }
  }

  function updateInstances() {
    for (let i = 0; i < NUM_BOIDS; i++) {
      const pos = torusPoint(bu[i], bv[i]);
      const tU = torusTangentU(bu[i], bv[i]);
      const tV = torusTangentV(bu[i], bv[i]);

      // Velocity direction in 3D: blend of tangent vectors
      const velDir = new THREE.Vector3()
        .addScaledVector(tU, bdu[i])
        .addScaledVector(tV, bdv[i])
        .normalize();

      // Normal to torus surface
      const normal = new THREE.Vector3().crossVectors(tU, tV).normalize();

      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().add(velDir));
      // Ensure up is surface normal
      const m = new THREE.Matrix4();
      m.lookAt(pos, pos.clone().add(velDir), normal);
      dummy.quaternion.setFromRotationMatrix(m);
      dummy.updateMatrix();
      boidMesh.setMatrixAt(i, dummy.matrix);
    }
    boidMesh.instanceMatrix.needsUpdate = true;
  }

  let running = true;
  const clock = new THREE.Clock();

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    updateBoids(dt);
    updateInstances();

    // Camera orbit
    camera.position.set(
      Math.sin(elapsed * 0.1) * 5.5,
      2.5 + Math.sin(elapsed * 0.07) * 1.5,
      Math.cos(elapsed * 0.1) * 5.5
    );
    camera.lookAt(0, 0, 0);

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
    boidGeo.dispose(); boidMat.dispose();
    torusGeo.dispose(); torusMat.dispose(); torusSolidMat.dispose();
    renderer.dispose();
  };
}
