// Particle galaxy scene: 18000 particles in logarithmic spiral arms
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060e);

  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);
  camera.position.set(0, 8, 14);
  camera.lookAt(0, 0, 0);

  // --- Particle parameters ---
  const PARTICLE_COUNT = 18000;
  const ARM_COUNT = 4;
  const ARM_SPREAD = 0.45;         // angular spread per arm
  const SPIRAL_TIGHTNESS = 0.3;    // logarithmic spiral factor
  const MAX_RADIUS = 12;
  const CORE_RADIUS = 0.8;
  const VERTICAL_SPREAD = 0.25;    // base vertical scatter

  // --- Build point positions and colors ---
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const velocities = new Float32Array(PARTICLE_COUNT); // angular velocity per particle

  const colorCore = new THREE.Color(1.0, 0.85, 0.5);   // warm gold center
  const colorMid = new THREE.Color(0.6, 0.7, 1.0);     // blue-white mid
  const colorOuter = new THREE.Color(0.3, 0.4, 0.9);   // cool blue edge
  const tmpColor = new THREE.Color();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Distribute along radius with bias toward center
    const t = Math.random();
    const radius = CORE_RADIUS + t * t * (MAX_RADIUS - CORE_RADIUS);

    // Pick a spiral arm
    const arm = Math.floor(Math.random() * ARM_COUNT);
    const armAngle = (arm / ARM_COUNT) * Math.PI * 2;

    // Logarithmic spiral: angle increases with log(radius)
    const spiralAngle = Math.log(radius / CORE_RADIUS + 0.01) / SPIRAL_TIGHTNESS;

    // Add noise to spread particles around the arm
    const noise = (Math.random() - 0.5) * ARM_SPREAD * (1.0 + radius * 0.15);

    const angle = armAngle + spiralAngle + noise;

    // Vertical spread decreases toward center (flat disk with puffy core)
    const ySpread = VERTICAL_SPREAD * radius * 0.15;
    const y = (Math.random() - 0.5) * ySpread * 2 + (Math.random() - 0.5) * 0.15;

    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(angle) * radius;

    // Color by distance: warm core -> cool outer
    const distNorm = Math.min((radius - CORE_RADIUS) / (MAX_RADIUS - CORE_RADIUS), 1.0);
    if (distNorm < 0.35) {
      tmpColor.copy(colorCore).lerp(colorMid, distNorm / 0.35);
    } else {
      tmpColor.copy(colorMid).lerp(colorOuter, (distNorm - 0.35) / 0.65);
    }

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;

    // Larger particles near center, smaller at edges
    sizes[i] = (1.0 - distNorm * 0.6) * (1.5 + Math.random() * 1.5);

    // Angular velocity: faster near center (Keplerian-ish)
    velocities[i] = 0.08 / (0.5 + radius * 0.3);
  }

  // --- Geometry ---
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // --- Shader material for point sprites with glow ---
  const vertexShader = `
    attribute float size;
    varying vec3 vColor;
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (200.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    varying vec3 vColor;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      // Soft glow falloff
      float alpha = 1.0 - smoothstep(0.0, 0.5, d);
      alpha = pow(alpha, 1.5);
      gl_FragColor = vec4(vColor * 1.2, alpha * 0.85);
    }
  `;

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // --- Core glow sprite ---
  const glowGeo = new THREE.PlaneGeometry(4, 4);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(1.0, 0.9, 0.6) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - vec2(0.5)) * 2.0;
        float glow = exp(-d * d * 3.0) * 0.6;
        gl_FragColor = vec4(uColor, glow);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glowPlane = new THREE.Mesh(glowGeo, glowMat);
  glowPlane.lookAt(camera.position);
  scene.add(glowPlane);

  // --- Animation ---
  const clock = new THREE.Clock();
  const posAttr = geometry.getAttribute('position');
  let running = true;

  // Store polar coords for efficient rotation
  const polarR = new Float32Array(PARTICLE_COUNT);
  const polarA = new Float32Array(PARTICLE_COUNT);
  const baseY = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const x = positions[i * 3];
    const z = positions[i * 3 + 2];
    polarR[i] = Math.sqrt(x * x + z * z);
    polarA[i] = Math.atan2(z, x);
    baseY[i] = positions[i * 3 + 1];
  }

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();
    const dt = Math.min(clock.getDelta(), 1 / 20);

    // Rotate particles along their orbits (differential rotation)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      polarA[i] += velocities[i] * dt;
      const r = polarR[i];
      posAttr.array[i * 3] = Math.cos(polarA[i]) * r;
      posAttr.array[i * 3 + 2] = Math.sin(polarA[i]) * r;
      // Gentle vertical bob
      posAttr.array[i * 3 + 1] = baseY[i] + Math.sin(elapsed * 0.4 + r) * 0.03;
    }
    posAttr.needsUpdate = true;

    // Slow overall scene rotation for visual interest
    points.rotation.y += dt * 0.02;

    // Camera gentle orbit
    const camAngle = elapsed * 0.06;
    camera.position.x = Math.sin(camAngle) * 14;
    camera.position.z = Math.cos(camAngle) * 14;
    camera.position.y = 7 + Math.sin(elapsed * 0.1) * 1.5;
    camera.lookAt(0, -0.5, 0);

    // Keep glow plane facing camera
    glowPlane.lookAt(camera.position);

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
    glowGeo.dispose();
    glowMat.dispose();
    renderer.dispose();
  };
}
