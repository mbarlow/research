// Impossible geometry — ray marched Penrose tribar and impossible objects
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

mat2 rot2(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

// Rotation matrices
vec3 rotX(vec3 p, float a) { p.yz *= rot2(a); return p; }
vec3 rotY(vec3 p, float a) { p.xz *= rot2(a); return p; }
vec3 rotZ(vec3 p, float a) { p.xy *= rot2(a); return p; }

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdRoundBox(vec3 p, vec3 b, float r) {
  return sdBox(p, b) - r;
}

// Penrose Tribar: three bars arranged in an impossible triangle
// Each bar is a rounded box, positioned so they appear to connect
// at the "impossible" viewing angle
float penroseTribar(vec3 p) {
  float barW = 0.18;
  float barR = 0.04;
  float armLen = 1.2;

  // Bar 1: along X axis
  vec3 p1 = p;
  p1.x -= 0.0;
  p1.y -= -0.6;
  float bar1 = sdRoundBox(p1, vec3(armLen, barW, barW), barR);

  // Bar 2: rotated 120 degrees
  vec3 p2 = rotZ(p, 2.094);
  p2.x -= 0.0;
  p2.y -= -0.6;
  float bar2 = sdRoundBox(p2, vec3(armLen, barW, barW), barR);

  // Bar 3: rotated -120 degrees
  vec3 p3 = rotZ(p, -2.094);
  p3.x -= 0.0;
  p3.y -= -0.6;
  float bar3 = sdRoundBox(p3, vec3(armLen, barW, barW), barR);

  return min(bar1, min(bar2, bar3));
}

// Impossible cube: bars that cross impossibly
float impossibleCube(vec3 p) {
  float s = 0.6;
  float barW = 0.06;

  float d = 1e10;

  // 12 edges of a cube, but with two of them crossing
  // Front face
  d = min(d, sdBox(p - vec3(0, 0, s), vec3(s, barW, barW)));
  d = min(d, sdBox(p - vec3(0, 0, s), vec3(barW, s, barW)));
  d = min(d, sdBox(p - vec3(s, 0, s), vec3(barW, s, barW)));
  d = min(d, sdBox(p - vec3(0, s, s), vec3(s, barW, barW)));

  // Back face
  d = min(d, sdBox(p - vec3(0, 0, -s), vec3(s, barW, barW)));
  d = min(d, sdBox(p - vec3(0, 0, -s), vec3(barW, s, barW)));
  d = min(d, sdBox(p - vec3(s, 0, -s), vec3(barW, s, barW)));
  d = min(d, sdBox(p - vec3(0, s, -s), vec3(s, barW, barW)));

  // Connecting edges (these create the impossibility)
  d = min(d, sdBox(p - vec3(-s, -s, 0), vec3(barW, barW, s)));
  d = min(d, sdBox(p - vec3(s, -s, 0), vec3(barW, barW, s)));
  d = min(d, sdBox(p - vec3(-s, s, 0), vec3(barW, barW, s)));
  d = min(d, sdBox(p - vec3(s, s, 0), vec3(barW, barW, s)));

  return d;
}

// Moebius-like twisted ring
float moebiusRing(vec3 p) {
  // Parametric twist
  float a = atan(p.z, p.x);
  float r = length(p.xz) - 1.0;

  // Twist the cross-section by half the angle
  vec2 cross = vec2(r, p.y);
  float twist = a * 0.5;
  cross *= rot2(twist);

  // Rounded rectangle cross section
  return sdBox(vec3(cross.x, cross.y, 0.0), vec3(0.12, 0.04, 0.04)) - 0.02;
}

// Scene: multiple impossible objects
float map(vec3 p) {
  float d = 1e10;

  // Penrose tribar (left)
  vec3 p1 = p - vec3(-2.5, 0.0, 0.0);
  // Slowly oscillate between "impossible" and "reveal" angle
  float reveal = sin(uTime * 0.3) * 0.15;
  p1 = rotX(p1, 0.6 + reveal);
  p1 = rotY(p1, -0.3 + reveal * 0.5);
  d = min(d, penroseTribar(p1));

  // Impossible cube (center)
  vec3 p2 = p - vec3(0.0, 0.0, 0.0);
  p2 = rotX(p2, 0.5 + sin(uTime * 0.25) * 0.2);
  p2 = rotY(p2, 0.4 + uTime * 0.08);
  d = min(d, impossibleCube(p2));

  // Moebius ring (right)
  vec3 p3 = p - vec3(2.8, 0.0, 0.0);
  p3 = rotX(p3, 0.3);
  p3 = rotY(p3, uTime * 0.15);
  d = min(d, moebiusRing(p3));

  return d;
}

// Color based on which object was hit
vec3 objectColor(vec3 p) {
  vec3 p1 = p - vec3(-2.5, 0.0, 0.0);
  float reveal = sin(uTime * 0.3) * 0.15;
  p1 = rotX(p1, 0.6 + reveal);
  p1 = rotY(p1, -0.3 + reveal * 0.5);
  float d1 = penroseTribar(p1);

  vec3 p2 = p - vec3(0.0, 0.0, 0.0);
  p2 = rotX(p2, 0.5 + sin(uTime * 0.25) * 0.2);
  p2 = rotY(p2, 0.4 + uTime * 0.08);
  float d2 = impossibleCube(p2);

  vec3 p3 = p - vec3(2.8, 0.0, 0.0);
  p3 = rotX(p3, 0.3);
  p3 = rotY(p3, uTime * 0.15);
  float d3 = moebiusRing(p3);

  if (d1 < d2 && d1 < d3) {
    // Tribar: colored by which arm
    float angle = atan(p1.y, p1.x);
    float t = fract(angle / 6.28318 + 0.5);
    if (t < 0.33) return vec3(0.8, 0.25, 0.2);
    if (t < 0.67) return vec3(0.2, 0.7, 0.3);
    return vec3(0.2, 0.35, 0.8);
  }
  if (d2 < d3) {
    // Cube: warm white
    return vec3(0.8, 0.75, 0.65);
  }
  // Moebius: purple-gold
  float t2 = atan(p3.z, p3.x) / 6.28318 + 0.5;
  return mix(vec3(0.6, 0.2, 0.7), vec3(0.9, 0.75, 0.3), smoothstep(0.3, 0.7, fract(t2 * 3.0)));
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
  float s = 1.0;
  for (int i = 0; i < 5; i++) {
    float d = 0.01 + 0.05 * float(i);
    ao += (d - map(p + n * d)) * s;
    s *= 0.5;
  }
  return clamp(1.0 - ao * 5.0, 0.0, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / uResolution.y;

  // Camera
  vec3 ro = vec3(0.0, 0.5, 5.0);
  vec3 ta = vec3(0.0, 0.0, 0.0);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0, 1, 0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.5 * ww);

  // Ray march
  float t = 0.0;
  vec3 p;
  bool hit = false;
  for (int i = 0; i < 96; i++) {
    p = ro + rd * t;
    float d = map(p);
    if (d < 0.0005) { hit = true; break; }
    if (t > 20.0) break;
    t += d;
  }

  vec3 col = vec3(0.03, 0.03, 0.05);

  if (hit) {
    vec3 n = calcNormal(p);
    float ao = calcAO(p, n);
    vec3 baseCol = objectColor(p);

    vec3 L = normalize(vec3(0.5, 0.8, 0.6));
    float diff = max(dot(n, L), 0.0) * 0.7;
    float spec = pow(max(dot(reflect(-L, n), -rd), 0.0), 32.0) * 0.4;
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * 0.2;
    float ambient = 0.12;

    col = baseCol * (ambient + diff * ao) + vec3(0.9, 0.85, 0.7) * spec * ao + vec3(0.3, 0.4, 0.6) * rim;

    float fog = 1.0 - exp(-t * 0.08);
    col = mix(col, vec3(0.03, 0.03, 0.05), fog);
  }

  // Vignette
  vec2 vuv = vUv - 0.5;
  col *= 1.0 - dot(vuv, vuv) * 0.6;

  col = pow(col, vec3(0.9));
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

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(width, height) },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
  });

  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

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
