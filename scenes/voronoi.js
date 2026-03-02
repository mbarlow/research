// Voronoi diagram rendered in real time via GLSL distance fields
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

// Hash function for reproducible randomness
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float scale = 5.0;
  vec2 p = uv * scale;
  vec2 ip = floor(p);
  vec2 fp = fract(p);

  float minDist = 10.0;
  float secondDist = 10.0;
  vec2 minPoint = vec2(0.0);
  float minId = 0.0;

  // Check 3x3 neighborhood of cells
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 cellId = ip + neighbor;

      // Animated point position within cell
      vec2 point = hash2(cellId);
      point = 0.5 + 0.4 * sin(uTime * 0.5 + 6.2831 * point);

      vec2 diff = neighbor + point - fp;
      float dist = length(diff);

      if (dist < minDist) {
        secondDist = minDist;
        minDist = dist;
        minPoint = point;
        minId = dot(cellId, vec2(7.0, 113.0));
      } else if (dist < secondDist) {
        secondDist = dist;
      }
    }
  }

  // Edge detection: difference between closest and second-closest
  float edge = secondDist - minDist;

  // Color each cell based on its ID
  vec3 cellColor = 0.5 + 0.5 * cos(6.2831 * hash2(vec2(minId)).xyx + vec3(0.0, 1.0, 2.0));

  // Darken based on distance from cell center (subtle gradient)
  cellColor *= 0.7 + 0.3 * (1.0 - minDist);

  // Draw edges as dark lines
  float edgeLine = 1.0 - smoothstep(0.0, 0.05, edge);

  // Point highlights
  float pointDot = 1.0 - smoothstep(0.0, 0.04, minDist);

  vec3 col = cellColor;
  col = mix(col, vec3(0.02, 0.03, 0.06), edgeLine * 0.9);
  col += vec3(0.9, 0.9, 0.95) * pointDot * 0.6;

  // Subtle vignette
  vec2 center = gl_FragCoord.xy / uResolution - 0.5;
  float vignette = 1.0 - dot(center, center) * 0.8;
  col *= vignette;

  // Gamma
  col = pow(col, vec3(0.4545));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(
      width * Math.min(window.devicePixelRatio, 2),
      height * Math.min(window.devicePixelRatio, 2)
    )},
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

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    uniforms.uTime.value = clock.getElapsedTime();
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    const dpr = Math.min(window.devicePixelRatio, 2);
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
