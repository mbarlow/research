// Mandelbulb 3D fractal rendered via ray marching on a fullscreen quad
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
uniform float uPower;

// Mandelbulb distance estimator
// Based on the triplex algebra formulation
vec2 mandelbulb(vec3 pos, float power) {
  vec3 z = pos;
  float dr = 1.0;
  float r = 0.0;
  int iterations = 0;

  for (int i = 0; i < 12; i++) {
    iterations = i;
    r = length(z);
    if (r > 2.0) break;

    // Convert to spherical coordinates
    float theta = acos(z.z / r);
    float phi = atan(z.y, z.x);
    dr = pow(r, power - 1.0) * power * dr + 1.0;

    // Scale and rotate the point
    float zr = pow(r, power);
    theta = theta * power;
    phi = phi * power;

    // Convert back to cartesian
    z = zr * vec3(
      sin(theta) * cos(phi),
      sin(theta) * sin(phi),
      cos(theta)
    );
    z += pos;
  }

  // Distance estimation formula
  float dist = 0.5 * log(r) * r / dr;
  return vec2(dist, float(iterations));
}

// Soft shadow estimation
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k, float power) {
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < 32; i++) {
    if (t > maxt) break;
    vec2 h = mandelbulb(ro + rd * t, power);
    if (h.x < 0.0005) return 0.0;
    res = min(res, k * h.x / t);
    t += h.x;
  }
  return clamp(res, 0.0, 1.0);
}

// Calculate normal via gradient
vec3 calcNormal(vec3 pos, float power) {
  vec2 e = vec2(0.0005, 0.0);
  return normalize(vec3(
    mandelbulb(pos + e.xyy, power).x - mandelbulb(pos - e.xyy, power).x,
    mandelbulb(pos + e.yxy, power).x - mandelbulb(pos - e.yxy, power).x,
    mandelbulb(pos + e.yyx, power).x - mandelbulb(pos - e.yyx, power).x
  ));
}

// Orbit trap coloring
vec3 getColor(float iterations, vec3 pos) {
  float t = iterations / 12.0;
  vec3 col1 = vec3(0.05, 0.1, 0.25);   // deep blue
  vec3 col2 = vec3(0.3, 0.5, 0.9);     // mid blue
  vec3 col3 = vec3(0.9, 0.6, 0.2);     // gold
  vec3 col4 = vec3(0.95, 0.95, 0.95);  // near white

  vec3 col = mix(col1, col2, smoothstep(0.0, 0.3, t));
  col = mix(col, col3, smoothstep(0.3, 0.6, t));
  col = mix(col, col4, smoothstep(0.6, 1.0, t));

  // Add position-based variation
  col += 0.1 * cos(3.0 * pos.x + vec3(0.0, 1.0, 2.0));
  return col;
}

// Ambient occlusion
float calcAO(vec3 pos, vec3 nor, float power) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float hr = 0.01 + 0.04 * float(i);
    vec3 aopos = nor * hr + pos;
    float dd = mandelbulb(aopos, power).x;
    occ += -(dd - hr) * sca;
    sca *= 0.85;
  }
  return clamp(1.0 - 2.0 * occ, 0.0, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  // Camera setup — orbit around the fractal
  float angle = uTime * 0.15;
  float camDist = 2.8;
  vec3 ro = vec3(
    camDist * cos(angle),
    1.0 + 0.4 * sin(uTime * 0.1),
    camDist * sin(angle)
  );
  vec3 target = vec3(0.0);
  vec3 ww = normalize(target - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.5 * ww);

  float power = uPower;

  // Ray march
  float t = 0.0;
  float totalDist = 0.0;
  vec2 hit = vec2(0.0);
  bool found = false;

  for (int i = 0; i < 128; i++) {
    vec3 pos = ro + rd * t;
    hit = mandelbulb(pos, power);

    if (hit.x < 0.0005) {
      found = true;
      break;
    }
    if (t > 10.0) break;
    t += hit.x;
  }

  vec3 col = vec3(0.02, 0.03, 0.06); // background

  if (found) {
    vec3 pos = ro + rd * t;
    vec3 nor = calcNormal(pos, power);

    // Lighting
    vec3 lightDir = normalize(vec3(0.6, 0.8, -0.4));
    float diff = max(dot(nor, lightDir), 0.0);
    float spec = pow(max(dot(reflect(-lightDir, nor), -rd), 0.0), 32.0);
    float ao = calcAO(pos, nor, power);
    float shadow = softShadow(pos + nor * 0.002, lightDir, 0.01, 5.0, 16.0, power);

    vec3 baseColor = getColor(hit.y, pos);
    col = baseColor * (0.15 + 0.85 * diff * shadow) * ao;
    col += vec3(0.8, 0.9, 1.0) * spec * 0.3 * shadow;

    // Fog
    float fog = exp(-0.15 * t * t);
    col = mix(vec3(0.02, 0.03, 0.06), col, fog);
  }

  // Gamma correction
  col = pow(col, vec3(0.4545));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(width * Math.min(window.devicePixelRatio, 1.5), height * Math.min(window.devicePixelRatio, 1.5)) },
    uPower: { value: 8.0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  const clock = new THREE.Clock();
  let running = true;

  // Power oscillation: smoothly varies between 6 and 10
  function getPower(t) {
    return 8.0 + 2.0 * Math.sin(t * 0.08);
  }

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    uniforms.uPower.value = getPower(t);

    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    renderer.setSize(w, h);
    uniforms.uResolution.value.set(w * dpr, h * dpr);
  }
  window.addEventListener('resize', onResize);

  return () => {
    running = false;
    window.removeEventListener('resize', onResize);
    material.dispose();
    quad.geometry.dispose();
    renderer.dispose();
  };
}
