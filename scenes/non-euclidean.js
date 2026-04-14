// Non-Euclidean rendering — ray marching through hyperbolic space
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;

mat2 rot2(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// Log-polar domain repetition for hyperbolic-like tiling
vec3 hyperbolicFold(vec3 p) {
  float r = length(p.xz);
  float theta = atan(p.z, p.x);
  float logr = log(max(r, 0.001));

  float cellR = 0.7;
  float sectors = 7.0;

  // Cell ID for coloring
  float cellId = floor(logr / cellR) + floor(theta / (6.28318 / sectors)) * 13.0;

  logr = mod(logr + cellR * 0.5, cellR) - cellR * 0.5;
  theta = mod(theta + 3.14159 / sectors, 6.28318 / sectors) - 3.14159 / sectors;

  r = exp(logr);
  p.x = r * cos(theta);
  p.z = r * sin(theta);

  return p;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdCylinder(vec3 p, float r, float h) {
  float d = length(p.xz) - r;
  return max(d, abs(p.y) - h);
}

// Scene distance function
float map(vec3 p) {
  // Slow rotation
  p.xz *= rot2(uTime * 0.06);
  p.y += sin(uTime * 0.1) * 0.3;

  vec3 q = hyperbolicFold(p);

  // Pillars
  float pillar = sdCylinder(q, 0.06, 0.6);

  // Connecting arches between pillars
  vec3 aq = q;
  aq.y = abs(aq.y) - 0.55;
  float arch = sdBox(aq, vec3(0.15, 0.06, 0.06));

  // Floor and ceiling planes
  float floor_ = q.y + 0.6;
  float ceil_ = -(q.y - 0.65);

  // Cross beams
  vec3 bq = q;
  bq.xz *= rot2(0.7854);
  float beams = sdBox(bq, vec3(0.02, 0.7, 0.02));

  float d = min(pillar, arch);
  d = min(d, floor_);
  d = min(d, ceil_);
  d = min(d, beams);

  return d;
}

// Color from position — palette-driven
uniform vec3 uPalA;
uniform vec3 uPalB;
uniform vec3 uPalC;
uniform vec3 uBg;
uniform vec3 uSpec;

vec3 cellPalette(float t) {
  return uPalA + uPalB * cos(6.28318 * (uPalC * t + uPalA));
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

float calcAO(vec3 p, vec3 n) {
  float ao = 0.0;
  float scale = 1.0;
  for (int i = 0; i < 5; i++) {
    float dist = 0.02 + 0.06 * float(i);
    float d = map(p + n * dist);
    ao += (dist - d) * scale;
    scale *= 0.5;
  }
  return clamp(1.0 - ao * 4.0, 0.0, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;

  // Camera
  float ct = uTime * 0.08;
  vec3 ro = vec3(sin(ct) * 2.0, 0.3 + sin(uTime * 0.05) * 0.5, cos(ct) * 2.0);
  vec3 ta = vec3(0.0, 0.0, 0.0);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0, 1, 0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.2 * ww);

  // Ray march
  float t = 0.0;
  float d;
  vec3 p;
  bool hit = false;
  for (int i = 0; i < 80; i++) {
    p = ro + rd * t;
    d = map(p);
    if (d < 0.001) { hit = true; break; }
    if (t > 20.0) break;
    t += d;
  }

  vec3 col = uBg;

  if (hit) {
    vec3 n = calcNormal(p);
    float ao = calcAO(p, n);

    // Use folded position for cell coloring
    vec3 q = hyperbolicFold(p);
    float r = length(p.xz);
    float theta = atan(p.z, p.x);
    float logr = log(max(r, 0.001));
    float cellId = floor(logr / 0.7) * 7.0 + floor(theta / (6.28318 / 7.0));

    vec3 baseCol = cellPalette(cellId * 0.15 + uTime * 0.02);

    // Lighting
    vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
    float diff = max(dot(n, lightDir), 0.0) * 0.6;
    float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 16.0) * 0.3;
    float ambient = 0.15;

    col = baseCol * (ambient + diff * ao) + uSpec * spec * ao;

    // Fog
    float fog = 1.0 - exp(-t * 0.12);
    col = mix(col, uBg, fog);
  }

  // Vignette
  vec2 vuv = vUv - 0.5;
  col *= 1.0 - dot(vuv, vuv) * 0.8;

  // Gamma
  col = pow(col, vec3(0.85));

  gl_FragColor = vec4(col, 1.0);
}
`;

export function init(canvas, container, palette) {
  const hex = palette.as.hex;
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(width, height);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const v3 = (c) => new THREE.Vector3(c.r, c.g, c.b);
  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(width, height) },
    uPalA: { value: v3(palette.hues[4]) },  // teal base
    uPalB: { value: v3(palette.hues[2]) },  // amber amplitude
    uPalC: { value: new THREE.Vector3(0.5, 0.7, 1.0) },
    uBg:   { value: v3(palette.bg) },
    uSpec: { value: v3(palette.text) },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  let running = true;
  const clock = new THREE.Clock();

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    uniforms.uTime.value = clock.getElapsedTime();
    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    uniforms.uResolution.value.set(w, h);
    renderer.setSize(w, h);
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    renderer.setSize(w, h);
    uniforms.uResolution.value.set(w, h);
  }
  window.addEventListener('resize', onResize);

  return () => {
    running = false;
    window.removeEventListener('resize', onResize);
    material.dispose();
    renderer.dispose();
  };
}
