---
title: Reaction-Diffusion — Turing Patterns on the GPU
date: 2026-03-02
order: 21
description: Simulate the Gray-Scott reaction-diffusion model using GPU ping-pong framebuffers to generate Turing patterns in real time.
tags: [graphics, reaction-diffusion, simulation, turing-patterns, glsl, generative-art]
---

## Why Reaction-Diffusion

In 1952, Alan Turing published "The Chemical Basis of Morphogenesis," proposing that simple chemical reactions combined with diffusion could explain biological pattern formation -- spots on a leopard, stripes on a zebrafish, ridges on a fingerprint. The math is elegant: two chemicals interact and spread at different rates, and the imbalance between their diffusion speeds creates stable spatial patterns from uniform initial conditions. No template, no blueprint. Pattern emerges from process.

The Gray-Scott model is the most visually productive variant. Two chemicals, A and B, interact: A feeds the reaction, B consumes A and replicates. Both diffuse, but at different rates. Two parameters -- feed rate and kill rate -- control which of dozens of distinct pattern types emerge: spots, stripes, spirals, pulsing solitons, worms, mitosis, and coral-like growth.

> [!note]
> Reaction-diffusion is not just a mathematical curiosity. It has been confirmed as the mechanism behind pigmentation patterns in several species. The same equations that run on your GPU govern actual biological morphogenesis.

## Post Plan (Feature Map)

| Section Goal | Blog Feature Used | Why |
|---|---|---|
| Explain the Gray-Scott equations | Code blocks + math | Make both the continuous and discrete forms concrete |
| Cover the GPU ping-pong technique | Mermaid diagram + code | The dual-framebuffer pattern is the core implementation trick |
| Show parameter space exploration | Table + callout | The feed/kill map is the most important reference |
| Build an interactive demo | Three.js scene embed | Watch patterns emerge and morph in real time |
| Address practical questions | Chat transcript | Handle the questions about parameters and seeding |

## The Gray-Scott Equations

Two coupled partial differential equations describe the system:

```
∂A/∂t = Da∇²A - ABB + f(1 - A)
∂B/∂t = Db∇²B + ABB - (f + k)B
```

Where:
- **A, B** are chemical concentrations (0 to 1)
- **Da, Db** are diffusion rates (Da > Db is essential)
- **f** is the feed rate (how fast A is replenished)
- **k** is the kill rate (how fast B decays)
- **∇²** is the Laplacian (spatial second derivative — how much a point differs from its neighbors)
- **ABB** is the reaction term (B catalyzes conversion of A into more B)

The asymmetry is key: A diffuses faster than B. This means A can spread into regions and "prepare the ground" before B arrives. B then converts A locally, creating a depletion zone that stops further growth in that direction. This competition between activation (B replicates) and inhibition (A depletion limits growth) produces spatial patterns.

## Discretizing for the GPU

On a pixel grid, the Laplacian becomes a stencil operation — subtract the center value multiplied by 4, add the four cardinal neighbors:

```glsl
// 5-point Laplacian stencil on a texture
vec2 laplacian = -4.0 * state;
laplacian += texture2D(uState, vUv + vec2(texelSize.x, 0.0)).rg;
laplacian += texture2D(uState, vUv - vec2(texelSize.x, 0.0)).rg;
laplacian += texture2D(uState, vUv + vec2(0.0, texelSize.y)).rg;
laplacian += texture2D(uState, vUv - vec2(0.0, texelSize.y)).rg;
```

The full simulation step in GLSL:

```glsl
void main() {
  vec2 state = texture2D(uState, vUv).rg;
  float a = state.r;
  float b = state.g;

  vec2 laplacian = /* stencil as above */;

  float abb = a * b * b;
  float da = Da * laplacian.r - abb + feed * (1.0 - a);
  float db = Db * laplacian.g + abb - (feed + kill) * b;

  gl_FragColor = vec4(
    clamp(a + da * dt, 0.0, 1.0),
    clamp(b + db * dt, 0.0, 1.0),
    0.0, 1.0
  );
}
```

> [!tip]
> Running multiple simulation steps per animation frame (8-16) dramatically speeds up pattern formation. Each step is cheap — just a texture read, some arithmetic, and a texture write — so the GPU handles it effortlessly.

## The Ping-Pong Technique

The simulation needs to read the current state to compute the next state. You cannot read from and write to the same texture simultaneously. The solution is two framebuffers (render targets) that alternate roles each step:

```mermaid
graph LR
    A[Buffer A current state] -->|Read| S[Simulation Shader]
    S -->|Write| B[Buffer B next state]
    B -->|Read| S2[Simulation Shader]
    S2 -->|Write| A2[Buffer A next state]
    A2 -->|...| LOOP[Repeat]
```

In code:

```javascript
// Each simulation step
simUniforms.uState.value = rtA.texture;  // read from A
renderer.setRenderTarget(rtB);            // write to B
renderer.render(simScene, camera);

// Swap references
[rtA, rtB] = [rtB, rtA];
```

This pattern appears everywhere in GPU simulation: fluid dynamics, cellular automata, any system where the next state depends on the current state of neighboring cells.

## Parameter Space

The feed/kill parameter pair controls which pattern type emerges. Small changes produce dramatically different results:

| Feed (f) | Kill (k) | Pattern Type |
|---|---|---|
| 0.037 | 0.060 | Spots (mitosis) |
| 0.030 | 0.062 | Stripes and labyrinths |
| 0.025 | 0.060 | Pulsing solitons |
| 0.040 | 0.060 | Worms |
| 0.014 | 0.054 | Moving spots |
| 0.018 | 0.051 | Spirals |
| 0.050 | 0.065 | Coral growth |
| 0.022 | 0.059 | Fingerprint ridges |

> [!note]
> Robert Munafo's "Xmorphia" gallery maps the entire feed/kill parameter space and catalogs every known pattern type. It is the definitive reference for exploring Gray-Scott behavior.

## Interactive Demo

The simulation below starts with several seed spots of chemical B on a uniform field of chemical A. Patterns emerge within seconds. The feed and kill parameters slowly drift between presets, causing the pattern to morph through different regimes -- from spots to stripes to worms and back.

<div data-scene="reaction-diffusion.js" style="width:100%;height:420px;"></div>

## Seeding Strategies

The initial conditions matter. A single seed spot will grow radially. Multiple seeds interact -- their depletion zones collide and create more complex boundaries. Some approaches:

```javascript
// Circular seed: set A=0.5, B=0.25 in a disc
function seedSpot(data, cx, cy, radius, size) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 < radius ** 2) {
        const idx = (y * size + x) * 4;
        data[idx] = 0.5;      // reduce A
        data[idx + 1] = 0.25; // inject B
      }
    }
  }
}

// Random noise seeding: produces more organic initial conditions
function seedNoise(data, size, probability) {
  for (let i = 0; i < size * size; i++) {
    if (Math.random() < probability) {
      data[i * 4] = 0.5;
      data[i * 4 + 1] = 0.25;
    }
  }
}
```

## Common Questions

```chat
user: Why do the patterns take so long to appear?
assistant: Reaction-diffusion is a slow process by nature. Chemical B needs to accumulate enough local concentration to trigger the autocatalytic reaction (ABB), and A needs time to diffuse into the surrounding area to create the inhibition field. Running 8-16 simulation steps per animation frame helps. At a 256x256 grid, you usually see clear patterns within 2000-5000 simulation steps (250-600 frames at 8 steps/frame). Larger grids take proportionally longer because the diffusion distances are the same but the texel count is higher.

user: What happens if Da equals Db?
assistant: Nothing interesting. The asymmetry Da > Db is essential for pattern formation. If both chemicals diffuse at the same rate, the Laplacian terms cancel out in the instability analysis and you get uniform decay to the steady state. Turing's key insight was that differential diffusion creates the instability. Typically Da/Db is around 2:1.

user: Can this run in 3D?
assistant: Yes, but the cost is cubic. A 256x256x256 grid has 16 million voxels, each needing a 6-point 3D Laplacian stencil. It is feasible on modern GPUs with 3D textures and compute shaders, but not with the simple fragment shader ping-pong approach used here. The resulting patterns are 3D analogs: spots become spheres, stripes become sheets and tubes, worms become tunnels. Volume rendering or marching cubes (see the marching cubes post) can extract the isosurface.

user: How do I find interesting parameter combinations?
assistant: Start with the known presets in the table above. Then nudge feed and kill by 0.001 increments. The interesting behavior lives in narrow bands -- most of the parameter space produces either uniform states or chaotic noise. Munafo's parameter map is the best visual guide. You can also set up a grid of small simulations running different parameters simultaneously and watch which ones produce patterns.
```
