// Fourier ocean waves — Gerstner wave sum with Phillips spectrum
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

const NUM_WAVES = 24;
const GRID_RES = 128;

// Vertex shader: Gerstner wave displacement
const OCEAN_VERT = `
uniform float uTime;
uniform vec2 uWaveDir[${NUM_WAVES}];
uniform float uWaveFreq[${NUM_WAVES}];
uniform float uWaveAmp[${NUM_WAVES}];
uniform float uWavePhase[${NUM_WAVES}];
uniform float uWaveSteep[${NUM_WAVES}];

varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
  vec3 pos = position;
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 bitangent = vec3(0.0, 0.0, 1.0);

  for (int i = 0; i < ${NUM_WAVES}; i++) {
    float dotP = dot(uWaveDir[i], pos.xz);
    float phase = dotP * uWaveFreq[i] + uTime * uWaveFreq[i] * 0.8 + uWavePhase[i];
    float s = sin(phase);
    float c = cos(phase);
    float a = uWaveAmp[i];
    float q = uWaveSteep[i];

    // Gerstner displacement
    pos.x -= q * a * uWaveDir[i].x * s;
    pos.z -= q * a * uWaveDir[i].y * s;
    pos.y += a * c;

    // Accumulate normal via partial derivatives
    float wa = uWaveFreq[i] * a;
    tangent.x -= q * uWaveDir[i].x * uWaveDir[i].x * wa * c;
    tangent.y += uWaveDir[i].x * wa * (-s);
    bitangent.z -= q * uWaveDir[i].y * uWaveDir[i].y * wa * c;
    bitangent.y += uWaveDir[i].y * wa * (-s);
  }

  vNormal = normalize(cross(bitangent, tangent));
  vWorldPos = pos;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const OCEAN_FRAG = `
precision highp float;
varying vec3 vWorldPos;
varying vec3 vNormal;
uniform vec3 uCameraPos;
uniform float uTime;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCameraPos - vWorldPos);

  // Sun direction
  vec3 L = normalize(vec3(0.4, 0.6, 0.3));

  // Fresnel
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  fresnel = 0.04 + 0.96 * fresnel;

  // Deep water color
  vec3 deepColor = vec3(0.01, 0.05, 0.12);
  vec3 shallowColor = vec3(0.02, 0.15, 0.2);
  float depth = smoothstep(-2.0, 1.0, vWorldPos.y);
  vec3 waterColor = mix(deepColor, shallowColor, depth);

  // Sky reflection (gradient)
  vec3 R = reflect(-V, N);
  float skyGrad = R.y * 0.5 + 0.5;
  vec3 skyColor = mix(vec3(0.15, 0.25, 0.4), vec3(0.5, 0.65, 0.85), skyGrad);

  // Specular
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 256.0);

  // Subsurface scattering approximation
  float sss = pow(max(dot(V, -L + N * 0.3), 0.0), 3.0) * 0.2;
  vec3 sssColor = vec3(0.0, 0.3, 0.2);

  // Combine
  vec3 col = mix(waterColor, skyColor, fresnel);
  col += vec3(1.0, 0.95, 0.8) * spec * 1.5;
  col += sssColor * sss;

  // Fog
  float dist = length(vWorldPos.xz);
  float fog = 1.0 - exp(-dist * 0.04);
  vec3 fogColor = vec3(0.4, 0.55, 0.7);
  col = mix(col, fogColor, fog * 0.6);

  // Tone mapping
  col = col / (col + 1.0);
  col = pow(col, vec3(0.9));

  gl_FragColor = vec4(col, 1.0);
}
`;

// Sky dome shader
const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w; // push to far plane
}
`;

const SKY_FRAG = `
precision highp float;
varying vec3 vDir;
uniform float uTime;

void main() {
  vec3 dir = normalize(vDir);
  float y = dir.y * 0.5 + 0.5;

  vec3 horizon = vec3(0.55, 0.6, 0.7);
  vec3 zenith = vec3(0.15, 0.25, 0.5);
  vec3 col = mix(horizon, zenith, pow(max(y, 0.0), 0.7));

  // Sun glow
  vec3 sunDir = normalize(vec3(0.4, 0.3, 0.3));
  float sunDot = max(dot(dir, sunDir), 0.0);
  col += vec3(1.0, 0.8, 0.5) * pow(sunDot, 64.0) * 2.0;
  col += vec3(1.0, 0.7, 0.4) * pow(sunDot, 8.0) * 0.3;

  gl_FragColor = vec4(col, 1.0);
}
`;

function generateWaves(windSpeed, windDir) {
  const waves = { dirs: [], freqs: [], amps: [], phases: [], steeps: [] };
  const g = 9.81;
  const L = windSpeed * windSpeed / g;

  for (let i = 0; i < NUM_WAVES; i++) {
    // Random direction biased toward wind
    const angle = (Math.random() - 0.5) * Math.PI * 0.8 + Math.atan2(windDir[1], windDir[0]);
    const dir = [Math.cos(angle), Math.sin(angle)];

    // Frequency range: short waves to long swells
    const freq = 0.3 + Math.random() * 2.5;
    const k = freq * freq / g; // wavenumber from dispersion relation
    const kLen = k;

    // Phillips spectrum amplitude
    const kDotW = dir[0] * windDir[0] + dir[1] * windDir[1];
    const phillips = Math.exp(-1.0 / (kLen * L * kLen * L)) / (kLen * kLen * kLen * kLen) * (kDotW * kDotW);
    const amp = Math.sqrt(Math.max(phillips, 0)) * 0.015;

    // Steepness (Q parameter)
    const steepness = Math.min(1.0 / (freq * amp * NUM_WAVES + 0.001), 1.0) * 0.6;

    waves.dirs.push(dir[0], dir[1]);
    waves.freqs.push(freq);
    waves.amps.push(amp);
    waves.phases.push(Math.random() * Math.PI * 2);
    waves.steeps.push(steepness);
  }
  return waves;
}

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);

  // Generate wave parameters
  const windSpeed = 8.0;
  const windDir = [0.7, 0.7];
  const waves = generateWaves(windSpeed, windDir);

  // Ocean mesh
  const oceanGeo = new THREE.PlaneGeometry(40, 40, GRID_RES, GRID_RES);
  oceanGeo.rotateX(-Math.PI / 2);

  const waveUniforms = {
    uTime: { value: 0 },
    uCameraPos: { value: new THREE.Vector3() },
  };

  // Set wave uniforms
  for (let i = 0; i < NUM_WAVES; i++) {
    waveUniforms[`uWaveDir[${i}]`] = { value: new THREE.Vector2(waves.dirs[i * 2], waves.dirs[i * 2 + 1]) };
    waveUniforms[`uWaveFreq[${i}]`] = { value: waves.freqs[i] };
    waveUniforms[`uWaveAmp[${i}]`] = { value: waves.amps[i] };
    waveUniforms[`uWavePhase[${i}]`] = { value: waves.phases[i] };
    waveUniforms[`uWaveSteep[${i}]`] = { value: waves.steeps[i] };
  }

  const oceanMat = new THREE.ShaderMaterial({
    vertexShader: OCEAN_VERT,
    fragmentShader: OCEAN_FRAG,
    uniforms: waveUniforms,
    side: THREE.DoubleSide,
  });

  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  scene.add(ocean);

  // Sky dome
  const skyGeo = new THREE.SphereGeometry(80, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: { uTime: waveUniforms.uTime },
    side: THREE.BackSide,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  let running = true;
  const clock = new THREE.Clock();

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();
    waveUniforms.uTime.value = t;

    // Camera orbit at low angle
    const cx = Math.sin(t * 0.05) * 12;
    const cz = Math.cos(t * 0.05) * 12;
    camera.position.set(cx, 3.0 + Math.sin(t * 0.1) * 0.5, cz);
    camera.lookAt(0, -0.5, 0);
    waveUniforms.uCameraPos.value.copy(camera.position);

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
    oceanGeo.dispose(); oceanMat.dispose();
    skyGeo.dispose(); skyMat.dispose();
    renderer.dispose();
  };
}
