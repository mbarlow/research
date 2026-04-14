// Physarum (slime mold) simulation — GPU agent-based trail following
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

const TRAIL_SIZE = 512;
const AGENT_SIZE = 200; // 200x200 = 40000 agents

const FULLSCREEN_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

// Agent update: sense trail, turn, move
const AGENT_UPDATE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uAgents;
uniform sampler2D uTrail;
uniform float uSensorDist;
uniform float uSensorAngle;
uniform float uTurnSpeed;
uniform float uMoveSpeed;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec4 agent = texture2D(uAgents, vUv);
  float x = agent.r;
  float y = agent.g;
  float heading = agent.b;

  float sA = uSensorAngle;
  float sD = uSensorDist;

  // Sense at three points ahead
  vec2 sL = fract(vec2(x + cos(heading - sA) * sD, y + sin(heading - sA) * sD));
  vec2 sC = fract(vec2(x + cos(heading) * sD, y + sin(heading) * sD));
  vec2 sR = fract(vec2(x + cos(heading + sA) * sD, y + sin(heading + sA) * sD));

  float valL = texture2D(uTrail, sL).r;
  float valC = texture2D(uTrail, sC).r;
  float valR = texture2D(uTrail, sR).r;

  float rnd = hash(vUv + fract(uTime));

  if (valC >= valL && valC >= valR) {
    heading += (rnd - 0.5) * 0.05;
  } else if (valL > valR) {
    heading -= uTurnSpeed;
  } else if (valR > valL) {
    heading += uTurnSpeed;
  } else {
    heading += (rnd > 0.5 ? 1.0 : -1.0) * uTurnSpeed;
  }

  x = fract(x + cos(heading) * uMoveSpeed);
  y = fract(y + sin(heading) * uMoveSpeed);

  gl_FragColor = vec4(x, y, heading, 1.0);
}
`;

// Deposit: agents rendered as points into trail texture
const DEPOSIT_VERT = `
uniform sampler2D uAgents;
uniform float uAgentSize;
attribute vec2 aAgentUV;

void main() {
  vec4 agent = texture2D(uAgents, aAgentUV);
  vec2 pos = agent.xy * 2.0 - 1.0;
  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = 1.0;
}
`;

const DEPOSIT_FRAG = `
precision highp float;
void main() {
  gl_FragColor = vec4(0.15, 0.0, 0.0, 1.0);
}
`;

// Diffuse + decay trail
const DIFFUSE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTrail;
uniform vec2 uTexelSize;
uniform float uDecay;

void main() {
  float sum = 0.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 offset = vec2(float(dx), float(dy)) * uTexelSize;
      sum += texture2D(uTrail, vUv + offset).r;
    }
  }
  sum = sum / 9.0 * uDecay;
  gl_FragColor = vec4(sum, sum, sum, 1.0);
}
`;

// Display trail as color
const DISPLAY_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTrail;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uC4;

void main() {
  float val = texture2D(uTrail, vUv).r;
  vec3 col = mix(uC1, uC2, smoothstep(0.0, 0.05, val));
  col = mix(col, uC3, smoothstep(0.05, 0.2, val));
  col = mix(col, uC4, smoothstep(0.2, 0.5, val));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function init(canvas, container, palette) {
  const hex = palette.as.hex;
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setSize(width, height);
  renderer.autoClear = false;

  const rtOpts = {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  };
  const rtLinear = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  };

  // Agent textures (ping-pong)
  let agentA = new THREE.WebGLRenderTarget(AGENT_SIZE, AGENT_SIZE, rtOpts);
  let agentB = new THREE.WebGLRenderTarget(AGENT_SIZE, AGENT_SIZE, rtOpts);

  // Trail textures (ping-pong)
  let trailA = new THREE.WebGLRenderTarget(TRAIL_SIZE, TRAIL_SIZE, rtLinear);
  let trailB = new THREE.WebGLRenderTarget(TRAIL_SIZE, TRAIL_SIZE, rtLinear);

  // Initialize agents: random positions and headings
  const agentData = new Float32Array(AGENT_SIZE * AGENT_SIZE * 4);
  for (let i = 0; i < AGENT_SIZE * AGENT_SIZE; i++) {
    // Start in a ring pattern for interesting initial behavior
    const angle = Math.random() * Math.PI * 2;
    const r = 0.2 + Math.random() * 0.2;
    agentData[i * 4] = 0.5 + Math.cos(angle) * r;
    agentData[i * 4 + 1] = 0.5 + Math.sin(angle) * r;
    agentData[i * 4 + 2] = Math.random() * Math.PI * 2; // heading
    agentData[i * 4 + 3] = 1.0;
  }

  const agentInitTex = new THREE.DataTexture(agentData, AGENT_SIZE, AGENT_SIZE, THREE.RGBAFormat, THREE.FloatType);
  agentInitTex.needsUpdate = true;

  // Blit initial agent state
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);

  const blitMat = new THREE.MeshBasicMaterial({ map: agentInitTex });
  const blitScene = new THREE.Scene();
  blitScene.add(new THREE.Mesh(quadGeo, blitMat));
  renderer.setRenderTarget(agentA);
  renderer.clear();
  renderer.render(blitScene, ortho);
  renderer.setRenderTarget(null);
  blitMat.dispose();
  agentInitTex.dispose();

  // Clear trail textures
  renderer.setRenderTarget(trailA);
  renderer.clear();
  renderer.setRenderTarget(trailB);
  renderer.clear();
  renderer.setRenderTarget(null);

  // Agent update material
  const agentUniforms = {
    uAgents: { value: agentA.texture },
    uTrail: { value: trailA.texture },
    uSensorDist: { value: 0.02 },
    uSensorAngle: { value: 0.5 },
    uTurnSpeed: { value: 0.3 },
    uMoveSpeed: { value: 0.002 },
    uTime: { value: 0 },
  };
  const agentMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: AGENT_UPDATE_FRAG,
    uniforms: agentUniforms,
  });
  const agentScene = new THREE.Scene();
  agentScene.add(new THREE.Mesh(quadGeo, agentMat));

  // Deposit: point cloud sampling agent positions
  const agentUVs = new Float32Array(AGENT_SIZE * AGENT_SIZE * 2);
  for (let y = 0; y < AGENT_SIZE; y++) {
    for (let x = 0; x < AGENT_SIZE; x++) {
      const i = y * AGENT_SIZE + x;
      agentUVs[i * 2] = (x + 0.5) / AGENT_SIZE;
      agentUVs[i * 2 + 1] = (y + 0.5) / AGENT_SIZE;
    }
  }
  const depositGeo = new THREE.BufferGeometry();
  depositGeo.setAttribute('aAgentUV', new THREE.BufferAttribute(agentUVs, 2));
  depositGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AGENT_SIZE * AGENT_SIZE * 3), 3)); // dummy

  const depositUniforms = {
    uAgents: { value: agentA.texture },
    uAgentSize: { value: AGENT_SIZE },
  };
  const depositMat = new THREE.ShaderMaterial({
    vertexShader: DEPOSIT_VERT,
    fragmentShader: DEPOSIT_FRAG,
    uniforms: depositUniforms,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
  const depositPoints = new THREE.Points(depositGeo, depositMat);
  const depositScene = new THREE.Scene();
  depositScene.add(depositPoints);

  // Diffuse material
  const diffuseUniforms = {
    uTrail: { value: trailA.texture },
    uTexelSize: { value: new THREE.Vector2(1 / TRAIL_SIZE, 1 / TRAIL_SIZE) },
    uDecay: { value: 0.96 },
  };
  const diffuseMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: DIFFUSE_FRAG,
    uniforms: diffuseUniforms,
  });
  const diffuseScene = new THREE.Scene();
  diffuseScene.add(new THREE.Mesh(quadGeo, diffuseMat));

  // Display material
  const v3 = (c) => new THREE.Vector3(c.r, c.g, c.b);
  const displayUniforms = {
    uTrail: { value: trailA.texture },
    uC1: { value: v3(palette.bg) },
    uC2: { value: v3(palette.hues[4]) },    // teal (dim trail)
    uC3: { value: v3(palette.accent) },     // orange (active)
    uC4: { value: v3(palette.text) },       // cream (hot)
  };
  const displayMat = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: DISPLAY_FRAG,
    uniforms: displayUniforms,
  });
  const displayScene = new THREE.Scene();
  displayScene.add(new THREE.Mesh(quadGeo, displayMat));

  let running = true;
  let time = 0;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    time += 0.016;

    // Slowly drift parameters
    const t = time * 0.05;
    agentUniforms.uSensorAngle.value = 0.4 + Math.sin(t) * 0.3;
    agentUniforms.uSensorDist.value = 0.015 + Math.sin(t * 0.7) * 0.01;
    agentUniforms.uTurnSpeed.value = 0.25 + Math.sin(t * 1.3) * 0.15;
    diffuseUniforms.uDecay.value = 0.94 + Math.sin(t * 0.5) * 0.03;

    const stepsPerFrame = 2;
    for (let s = 0; s < stepsPerFrame; s++) {
      agentUniforms.uTime.value = time + s * 0.001;

      // 1. Update agents
      agentUniforms.uAgents.value = agentA.texture;
      agentUniforms.uTrail.value = trailA.texture;
      renderer.setRenderTarget(agentB);
      renderer.clear();
      renderer.render(agentScene, ortho);

      // Swap agent buffers
      const tmpA = agentA; agentA = agentB; agentB = tmpA;

      // 2. Deposit trail: copy current trail to trailB first, then add deposits
      diffuseUniforms.uTrail.value = trailA.texture;
      diffuseUniforms.uDecay.value = 1.0; // no decay for copy pass
      renderer.setRenderTarget(trailB);
      renderer.clear();
      renderer.render(diffuseScene, ortho);

      // Deposit agents onto trailB
      depositUniforms.uAgents.value = agentA.texture;
      renderer.setRenderTarget(trailB);
      renderer.render(depositScene, ortho);

      // 3. Diffuse + decay from trailB into trailA
      diffuseUniforms.uTrail.value = trailB.texture;
      diffuseUniforms.uDecay.value = 0.94 + Math.sin(time * 0.05 * 0.5) * 0.03;
      renderer.setRenderTarget(trailA);
      renderer.clear();
      renderer.render(diffuseScene, ortho);
    }

    // Display
    displayUniforms.uTrail.value = trailA.texture;
    renderer.setRenderTarget(null);
    renderer.setSize(container.clientWidth, container.clientHeight || 420);
    renderer.clear();
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
    agentA.dispose(); agentB.dispose();
    trailA.dispose(); trailB.dispose();
    agentMat.dispose(); depositMat.dispose();
    diffuseMat.dispose(); displayMat.dispose();
    quadGeo.dispose(); depositGeo.dispose();
    renderer.dispose();
  };
}
