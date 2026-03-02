// Reaction-Diffusion (Gray-Scott model) rendered via ping-pong framebuffers
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

// Simulation step: Gray-Scott reaction-diffusion
const SIM_SHADER = `
precision highp float;
varying vec2 vUv;

uniform sampler2D uState;
uniform vec2 uTexelSize;
uniform float uFeed;
uniform float uKill;
uniform float uDa;
uniform float uDb;
uniform float uDt;

void main() {
  vec2 state = texture2D(uState, vUv).rg;
  float a = state.r;
  float b = state.g;

  // 5-point Laplacian stencil
  vec2 laplacian = -4.0 * state;
  laplacian += texture2D(uState, vUv + vec2(uTexelSize.x, 0.0)).rg;
  laplacian += texture2D(uState, vUv - vec2(uTexelSize.x, 0.0)).rg;
  laplacian += texture2D(uState, vUv + vec2(0.0, uTexelSize.y)).rg;
  laplacian += texture2D(uState, vUv - vec2(0.0, uTexelSize.y)).rg;

  // Gray-Scott equations
  float abb = a * b * b;
  float da = uDa * laplacian.r - abb + uFeed * (1.0 - a);
  float db = uDb * laplacian.g + abb - (uFeed + uKill) * b;

  float newA = a + da * uDt;
  float newB = b + db * uDt;

  gl_FragColor = vec4(clamp(newA, 0.0, 1.0), clamp(newB, 0.0, 1.0), 0.0, 1.0);
}
`;

// Display shader: map chemical concentrations to color
const DISPLAY_SHADER = `
precision highp float;
varying vec2 vUv;

uniform sampler2D uState;

void main() {
  vec2 state = texture2D(uState, vUv).rg;
  float a = state.r;
  float b = state.g;

  // Color mapping based on chemical B concentration
  vec3 col1 = vec3(0.02, 0.04, 0.08);   // background (low B)
  vec3 col2 = vec3(0.1, 0.3, 0.6);      // transition
  vec3 col3 = vec3(0.3, 0.8, 0.9);      // active zone
  vec3 col4 = vec3(0.95, 0.95, 0.9);    // peak B

  float t = smoothstep(0.0, 0.3, b);
  vec3 col = mix(col1, col2, smoothstep(0.0, 0.1, b));
  col = mix(col, col3, smoothstep(0.1, 0.2, b));
  col = mix(col, col4, smoothstep(0.2, 0.4, b));

  // Subtle highlight from chemical A depletion
  col *= 0.7 + 0.3 * (1.0 - a);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setSize(width, height);

  const SIM_SIZE = 256;

  // Create two render targets for ping-pong
  const rtOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  };
  let rtA = new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, rtOptions);
  let rtB = new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, rtOptions);

  // Initialize state: chemical A = 1.0 everywhere, B = 0.0 with seed spots
  const initData = new Float32Array(SIM_SIZE * SIM_SIZE * 4);
  for (let i = 0; i < SIM_SIZE * SIM_SIZE; i++) {
    initData[i * 4] = 1.0;     // A
    initData[i * 4 + 1] = 0.0; // B
    initData[i * 4 + 2] = 0.0;
    initData[i * 4 + 3] = 1.0;
  }

  // Seed several spots with chemical B
  function seedSpot(cx, cy, radius) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < radius * radius) {
          const px = ((x % SIM_SIZE) + SIM_SIZE) % SIM_SIZE;
          const py = ((y % SIM_SIZE) + SIM_SIZE) % SIM_SIZE;
          const idx = (py * SIM_SIZE + px) * 4;
          initData[idx] = 0.5;
          initData[idx + 1] = 0.25;
        }
      }
    }
  }

  // Create initial seed pattern
  seedSpot(SIM_SIZE / 2, SIM_SIZE / 2, 8);
  seedSpot(SIM_SIZE / 3, SIM_SIZE / 3, 6);
  seedSpot(SIM_SIZE * 2 / 3, SIM_SIZE / 3, 5);
  seedSpot(SIM_SIZE / 3, SIM_SIZE * 2 / 3, 7);
  seedSpot(SIM_SIZE * 2 / 3, SIM_SIZE * 2 / 3, 6);

  const initTexture = new THREE.DataTexture(initData, SIM_SIZE, SIM_SIZE, THREE.RGBAFormat, THREE.FloatType);
  initTexture.needsUpdate = true;

  // Render initial state to rtA
  const initScene = new THREE.Scene();
  const initCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const initMat = new THREE.MeshBasicMaterial({ map: initTexture });
  const initQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), initMat);
  initScene.add(initQuad);
  renderer.setRenderTarget(rtA);
  renderer.render(initScene, initCam);
  renderer.setRenderTarget(null);
  initMat.dispose();
  initTexture.dispose();

  // Simulation material
  const simUniforms = {
    uState: { value: rtA.texture },
    uTexelSize: { value: new THREE.Vector2(1.0 / SIM_SIZE, 1.0 / SIM_SIZE) },
    uFeed: { value: 0.037 },
    uKill: { value: 0.06 },
    uDa: { value: 1.0 },
    uDb: { value: 0.5 },
    uDt: { value: 1.0 },
  };

  const simMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: SIM_SHADER,
    uniforms: simUniforms,
  });

  // Display material
  const displayUniforms = {
    uState: { value: rtA.texture },
  };

  const displayMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: DISPLAY_SHADER,
    uniforms: displayUniforms,
  });

  const simScene = new THREE.Scene();
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const simQuad = new THREE.Mesh(quadGeo, simMaterial);
  simScene.add(simQuad);

  const displayScene = new THREE.Scene();
  const displayQuad = new THREE.Mesh(quadGeo, displayMaterial);
  displayScene.add(displayQuad);

  const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let running = true;
  let frameCount = 0;

  // Slowly drift parameters for visual variety
  const presets = [
    { feed: 0.037, kill: 0.06 },   // Spots
    { feed: 0.03, kill: 0.062 },   // Stripes
    { feed: 0.025, kill: 0.06 },   // Pulsing solitons
    { feed: 0.04, kill: 0.06 },    // Worms
  ];
  let presetIdx = 0;
  let presetTimer = 0;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    frameCount++;

    // Slowly drift feed/kill parameters
    presetTimer += 0.0003;
    if (presetTimer > 1.0) {
      presetTimer = 0;
      presetIdx = (presetIdx + 1) % presets.length;
    }
    const nextIdx = (presetIdx + 1) % presets.length;
    const t = presetTimer;
    simUniforms.uFeed.value = presets[presetIdx].feed * (1 - t) + presets[nextIdx].feed * t;
    simUniforms.uKill.value = presets[presetIdx].kill * (1 - t) + presets[nextIdx].kill * t;

    // Run multiple simulation steps per frame for speed
    const stepsPerFrame = 8;
    for (let s = 0; s < stepsPerFrame; s++) {
      simUniforms.uState.value = rtA.texture;
      renderer.setRenderTarget(rtB);
      renderer.render(simScene, orthoCamera);

      // Swap
      const temp = rtA;
      rtA = rtB;
      rtB = temp;
    }

    // Display current state
    displayUniforms.uState.value = rtA.texture;
    renderer.setRenderTarget(null);
    renderer.setSize(container.clientWidth, container.clientHeight || 420);
    renderer.render(displayScene, orthoCamera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  return () => {
    running = false;
    window.removeEventListener('resize', onResize);
    rtA.dispose();
    rtB.dispose();
    simMaterial.dispose();
    displayMaterial.dispose();
    quadGeo.dispose();
    renderer.dispose();
  };
}
