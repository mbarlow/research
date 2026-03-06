// LLM-guided evolutionary art — genetic algorithm with shader genomes
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

const GRID_COLS = 4;
const GRID_ROWS = 2;
const POP_SIZE = GRID_COLS * GRID_ROWS;
const GENE_COUNT = 12;
const THUMB_SIZE = 128;

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const ART_SHADER = `
precision highp float;
varying vec2 vUv;
uniform float uGene[12];
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p, float octaves) {
  float val = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= octaves) break;
    val += noise(p * freq) * amp;
    freq *= 2.0;
    amp *= 0.5;
  }
  return val;
}

mat2 rot2(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

void main() {
  vec2 uv = vUv - 0.5;

  // Gene decoding
  float hue1 = uGene[0];
  float hue2 = uGene[1];
  float hue3 = uGene[2];
  float noiseFreq = 1.0 + uGene[3] * 8.0;
  float octaves = 1.0 + uGene[4] * 4.0;
  float symmetry = uGene[5];
  float rotation = uGene[6] * 6.28;
  float warpStr = uGene[7] * 2.0;
  float sat = 0.4 + uGene[8] * 0.6;
  float bright = 0.3 + uGene[9] * 0.6;
  float contrast = 0.5 + uGene[10] * 1.5;
  float blend = uGene[11];

  // Apply symmetry
  if (symmetry > 0.75) {
    // Radial 8
    float a = atan(uv.y, uv.x);
    float r = length(uv);
    a = mod(abs(a), 0.7854) - 0.3927;
    uv = vec2(cos(a), sin(a)) * r;
  } else if (symmetry > 0.5) {
    // Radial 4
    float a = atan(uv.y, uv.x);
    float r = length(uv);
    a = mod(abs(a), 1.5708) - 0.7854;
    uv = vec2(cos(a), sin(a)) * r;
  } else if (symmetry > 0.25) {
    // Mirror
    uv.x = abs(uv.x);
  }

  // Rotation
  uv *= rot2(rotation);

  // Domain warping
  vec2 warp = vec2(
    fbm(uv * noiseFreq + 5.2, octaves),
    fbm(uv * noiseFreq + 1.3, octaves)
  );
  uv += warp * warpStr * 0.3;

  // Main noise layers
  float n1 = fbm(uv * noiseFreq, octaves);
  float n2 = fbm(uv * noiseFreq * 2.0 + 10.0, max(octaves - 1.0, 1.0));

  // Color palette from hues
  vec3 c1 = vec3(0.5) + 0.5 * cos(6.28 * (hue1 + vec3(0.0, 0.33, 0.67)));
  vec3 c2 = vec3(0.5) + 0.5 * cos(6.28 * (hue2 + vec3(0.0, 0.33, 0.67)));
  vec3 c3 = vec3(0.5) + 0.5 * cos(6.28 * (hue3 + vec3(0.0, 0.33, 0.67)));

  vec3 col = mix(c1, c2, smoothstep(0.3, 0.7, n1));
  col = mix(col, c3, smoothstep(0.4, 0.8, n2) * blend);

  // Contrast
  col = pow(col, vec3(contrast));

  // Saturation
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, sat);

  // Brightness
  col *= bright * 1.5;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// Display shader: tile grid of thumbnails
const DISPLAY_SHADER = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uThumbs[8];
uniform int uBestIdx;
uniform float uGeneration;

void main() {
  vec2 uv = vUv;

  // Grid layout: 4 cols x 2 rows
  int col = int(floor(uv.x * 4.0));
  int row = int(floor((1.0 - uv.y) * 2.0));
  int idx = row * 4 + col;

  vec2 cellUv = vec2(fract(uv.x * 4.0), fract((1.0 - uv.y) * 2.0));
  // Flip Y for correct orientation
  cellUv.y = 1.0 - cellUv.y;

  // Add padding
  float pad = 0.03;
  vec3 bg = vec3(0.06, 0.06, 0.08);

  if (cellUv.x < pad || cellUv.x > 1.0 - pad || cellUv.y < pad || cellUv.y > 1.0 - pad) {
    // Border - highlight best
    if (idx == uBestIdx) {
      gl_FragColor = vec4(0.3, 0.8, 0.5, 1.0);
    } else {
      gl_FragColor = vec4(bg, 1.0);
    }
    return;
  }

  vec2 innerUv = (cellUv - pad) / (1.0 - 2.0 * pad);

  vec4 col4;
  if (idx == 0) col4 = texture2D(uThumbs[0], innerUv);
  else if (idx == 1) col4 = texture2D(uThumbs[1], innerUv);
  else if (idx == 2) col4 = texture2D(uThumbs[2], innerUv);
  else if (idx == 3) col4 = texture2D(uThumbs[3], innerUv);
  else if (idx == 4) col4 = texture2D(uThumbs[4], innerUv);
  else if (idx == 5) col4 = texture2D(uThumbs[5], innerUv);
  else if (idx == 6) col4 = texture2D(uThumbs[6], innerUv);
  else col4 = texture2D(uThumbs[7], innerUv);

  gl_FragColor = col4;
}
`;

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(width, height);

  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);

  // Thumbnail render targets
  const thumbs = [];
  for (let i = 0; i < POP_SIZE; i++) {
    thumbs.push(new THREE.WebGLRenderTarget(THUMB_SIZE, THUMB_SIZE, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    }));
  }

  // Art material for rendering individual candidates
  const artUniforms = {
    uGene: { value: new Array(GENE_COUNT).fill(0.5) },
    uTime: { value: 0 },
  };
  const artMat = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: ART_SHADER,
    uniforms: artUniforms,
  });
  const artScene = new THREE.Scene();
  artScene.add(new THREE.Mesh(quadGeo, artMat));

  // Display material
  const thumbUniforms = {};
  const thumbArray = [];
  for (let i = 0; i < POP_SIZE; i++) {
    thumbUniforms[`uThumbs[${i}]`] = { value: thumbs[i].texture };
    thumbArray.push(thumbs[i].texture);
  }
  const displayUniforms = {
    ...thumbUniforms,
    uBestIdx: { value: 0 },
    uGeneration: { value: 0 },
  };
  const displayMat = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: DISPLAY_SHADER,
    uniforms: displayUniforms,
  });
  const displayScene = new THREE.Scene();
  displayScene.add(new THREE.Mesh(quadGeo, displayMat));

  // Population: arrays of gene floats
  let population = [];
  let fitness = new Float32Array(POP_SIZE);
  let generation = 0;
  let bestIdx = 0;

  function randomGene() {
    return Math.random();
  }

  function randomGenome() {
    const g = [];
    for (let i = 0; i < GENE_COUNT; i++) g.push(randomGene());
    return g;
  }

  // Simulated fitness: heuristic for visual quality
  function evaluateFitness(genome) {
    // Reward: diverse colors, medium contrast, some symmetry, moderate complexity
    const hueSpread = Math.abs(genome[0] - genome[1]) + Math.abs(genome[1] - genome[2]);
    const complexity = genome[3] * 0.3 + genome[4] * 0.3;
    const symmetryBonus = genome[5] > 0.25 ? 0.3 : 0.0;
    const warpBonus = genome[7] > 0.2 && genome[7] < 0.8 ? 0.2 : 0.0;
    const contrastPenalty = genome[10] > 0.85 ? -0.3 : 0.0;
    const brightnessPenalty = genome[9] < 0.2 ? -0.3 : 0.0;

    return hueSpread * 0.5 + complexity + symmetryBonus + warpBonus + contrastPenalty + brightnessPenalty + Math.random() * 0.15;
  }

  function tournamentSelect() {
    const a = Math.floor(Math.random() * POP_SIZE);
    let b = Math.floor(Math.random() * POP_SIZE);
    while (b === a) b = Math.floor(Math.random() * POP_SIZE);
    return fitness[a] > fitness[b] ? a : b;
  }

  function crossover(p1, p2) {
    const child = [];
    for (let i = 0; i < GENE_COUNT; i++) {
      child.push(Math.random() < 0.5 ? p1[i] : p2[i]);
    }
    return child;
  }

  function mutate(genome, rate) {
    return genome.map(g => {
      if (Math.random() < rate) {
        return Math.max(0, Math.min(1, g + (Math.random() - 0.5) * 0.3));
      }
      return g;
    });
  }

  function evolve() {
    // Evaluate
    for (let i = 0; i < POP_SIZE; i++) {
      fitness[i] = evaluateFitness(population[i]);
    }

    // Find best
    bestIdx = 0;
    for (let i = 1; i < POP_SIZE; i++) {
      if (fitness[i] > fitness[bestIdx]) bestIdx = i;
    }
    displayUniforms.uBestIdx.value = bestIdx;

    // New generation
    const newPop = [];
    newPop.push([...population[bestIdx]]); // Elitism

    while (newPop.length < POP_SIZE) {
      const p1 = tournamentSelect();
      const p2 = tournamentSelect();
      let child = crossover(population[p1], population[p2]);
      child = mutate(child, 0.3);
      newPop.push(child);
    }

    population = newPop;
    generation++;
    displayUniforms.uGeneration.value = generation;
  }

  // Initialize population
  for (let i = 0; i < POP_SIZE; i++) {
    population.push(randomGenome());
  }

  // Render all candidates to thumbnails
  function renderThumbs() {
    for (let i = 0; i < POP_SIZE; i++) {
      artUniforms.uGene.value = population[i];
      renderer.setRenderTarget(thumbs[i]);
      renderer.render(artScene, ortho);
    }
    renderer.setRenderTarget(null);
  }

  renderThumbs();
  // Initial evaluation
  for (let i = 0; i < POP_SIZE; i++) {
    fitness[i] = evaluateFitness(population[i]);
  }

  let running = true;
  let timer = 0;
  const GEN_INTERVAL = 3.0; // seconds between generations

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    timer += 0.016;
    artUniforms.uTime.value = timer;

    if (timer > GEN_INTERVAL) {
      timer = 0;
      evolve();
      renderThumbs();
    }

    // Display grid
    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    renderer.setSize(w, h);
    renderer.setRenderTarget(null);
    renderer.render(displayScene, ortho);
  }
  animate();

  function onResize() {
    renderer.setSize(container.clientWidth, container.clientHeight || 420);
  }
  window.addEventListener('resize', onResize);

  return () => {
    running = false;
    window.removeEventListener('resize', onResize);
    thumbs.forEach(t => t.dispose());
    artMat.dispose();
    displayMat.dispose();
    quadGeo.dispose();
    renderer.dispose();
  };
}
