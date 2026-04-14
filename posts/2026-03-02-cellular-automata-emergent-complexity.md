---
title: Cellular Automata — Emergent Complexity from Simple Rules
date: 2026-03-02
order: 24
description: Explore cellular automata from Conway's Game of Life to 3D visualization, showing how simple local rules produce complex emergent behavior.
tags: [simulation, cellular-automata, game-of-life, emergence, generative-art, threejs]
---

## Why CA

A grid of cells. A finite number of states. Update rules that depend only on nearby neighbors.

No global coordination. No central plan. From this minimal setup: self-replicating patterns, gliders, Turing-complete computation, structures that look unsettlingly biological.

Conway's Game of Life (1970) is the famous example. The concept reaches back to von Neumann and Ulam in the 1940s, working on self-replication. Wolfram spent decades cataloguing 1D rules and arguing that simple rules suffice for any computable behavior.

Whether or not you buy the philosophy, CA remain one of the purest demonstrations that complexity does not require complicated causes.

> [!note]
> Conway's Life is Turing-complete. Logic gates, memory, arbitrary computation — all constructible from gliders and glider guns. A universal computer nobody would actually program. Theoretical capability is there.

## The rules

2D grid. Each cell alive (1) or dead (0). Every generation, all cells update simultaneously based on their 8 Moore neighbors.

| State | Neighbors | Next | Name |
|---|---|---|---|
| Alive | < 2 | Dead | Underpopulation |
| Alive | 2 or 3 | Alive | Survival |
| Alive | > 3 | Dead | Overpopulation |
| Dead | exactly 3 | Alive | Reproduction |

Shorthand: **B3/S23** (Birth on 3, Survive on 2 or 3).

```javascript
function stepGrid(current, next, size) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const alive = current[y * size + x];
      const neighbors = countNeighbors(current, x, y, size);

      if (alive) {
        next[y * size + x] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
      } else {
        next[y * size + x] = (neighbors === 3) ? 1 : 0;
      }
    }
  }
}
```

## Neighbors

8 surrounding cells. Wrap at edges → toroidal grid. Patterns exit one side, return on the opposite.

```javascript
function countNeighbors(grid, x, y, size) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = (x + dx + size) % size;
      const ny = (y + dy + size) % size;
      count += grid[ny * size + nx];
    }
  }
  return count;
}
```

Double-buffer (current → next, swap) is essential. Update in place and later cells see already-updated neighbors. Simulation breaks. Same ping-pong as reaction-diffusion, on the CPU.

## Emergent zoo

From four rules, no design:

| Pattern | Type | Behavior |
|---|---|---|
| Block (2×2 square) | Still life | Never changes |
| Beehive | Still life | Stable hexagon |
| Blinker (3 in a row) | Oscillator | Period 2 |
| Pulsar | Oscillator | 13×13, period 3 |
| Glider | Spaceship | Diagonal, one cell per 4 generations |
| LWSS | Spaceship | Lightweight, horizontal |
| Gosper Glider Gun | Gun | New glider every 30 generations |
| R-pentomino | Methuselah | 5 cells, 1103 generations to stabilize |

> [!tip]
> R-pentomino is the classic sensitive-dependence demo. Five cells. Over a thousand generations of chaos before settling into still lifes, oscillators, and escaped gliders.

## Wolfram's elementary automata

1D. Single row. Each cell looks at itself and two neighbors (3 cells = 8 input patterns). Output is 0 or 1 → 2⁸ = 256 possible rules. Each rule number encodes the output for all 8 inputs.

```javascript
function elementaryCA(rule, width, steps) {
  let current = new Uint8Array(width);
  current[Math.floor(width / 2)] = 1; // single seed

  const rows = [current.slice()];

  for (let s = 0; s < steps; s++) {
    const next = new Uint8Array(width);
    for (let i = 0; i < width; i++) {
      const left = current[(i - 1 + width) % width];
      const center = current[i];
      const right = current[(i + 1) % width];
      const pattern = (left << 2) | (center << 1) | right;
      next[i] = (rule >> pattern) & 1;
    }
    current = next;
    rows.push(current.slice());
  }
  return rows;
}
```

**Rule 30** — chaotic, random-looking output from a single seed.
**Rule 110** — proven Turing-complete.
**Rule 90** — Sierpinski triangle.

A single byte specifies the rule.

## 3D demo

40×40 grid. Current generation on top. Previous 12 stacked below as translucent layers — 3D history. Cells as instanced cubes for performance. Reseeds when the pattern stagnates.

<div data-scene="cellular-automata.js" style="width:100%;height:420px;"></div>

## On the GPU

Larger grids → ping-pong framebuffer. Same trick as reaction-diffusion.

```glsl
void main() {
  float alive = texture2D(uState, vUv).r;

  // Sample 8 neighbors
  float neighbors = 0.0;
  neighbors += texture2D(uState, vUv + vec2(-dx, -dy)).r;
  neighbors += texture2D(uState, vUv + vec2(  0, -dy)).r;
  neighbors += texture2D(uState, vUv + vec2( dx, -dy)).r;
  neighbors += texture2D(uState, vUv + vec2(-dx,   0)).r;
  neighbors += texture2D(uState, vUv + vec2( dx,   0)).r;
  neighbors += texture2D(uState, vUv + vec2(-dx,  dy)).r;
  neighbors += texture2D(uState, vUv + vec2(  0,  dy)).r;
  neighbors += texture2D(uState, vUv + vec2( dx,  dy)).r;

  // B3/S23
  float next = 0.0;
  if (alive > 0.5) {
    next = (neighbors > 1.5 && neighbors < 3.5) ? 1.0 : 0.0;
  } else {
    next = (neighbors > 2.5 && neighbors < 3.5) ? 1.0 : 0.0;
  }

  gl_FragColor = vec4(next, 0.0, 0.0, 1.0);
}
```

1024×1024 at 60fps. All cells in parallel.

## Variants

| Rule | B/S | Character |
|---|---|---|
| B3/S23 (Life) | Classic | Balanced chaos and stability |
| B36/S23 (HighLife) | Replicator | Has a small self-replicating pattern |
| B3678/S34678 (Day & Night) | Symmetric | Dead and alive cells interchangeable |
| B1/S12 (Seeds) | Explosive | Everything explodes |
| B2/S | Chaotic | Quick deaths, bursts |
| B368/S245 | Organic | Slow, amoeba-like growth |

## Common questions

```chat
user: How do I scale the grid without killing performance?
assistant: CPU JS handles 100×100 fine. Beyond that, GPU shader. 1024×1024 at 60fps because every cell processes in parallel. For the 3D viz with instanced cubes, the bottleneck is rendering — use InstancedMesh, only allocate for alive cells, frustum culling, LOD.

user: 3D cellular automata?
assistant: Yes. 26-neighbor Moore (3×3×3 minus center). Rules like B5/S4 and B6/S567 produce crystals, tunnels, pulsating blobs. Visualization is the hard part — you can't see the interior without cross-sections or transparency. Marching cubes extracts an isosurface from the alive-cell density field.

user: Is Life really Turing-complete?
assistant: Yes, proven. Rendell built a Turing machine in Life in 2000. Compact constructions exist now. Components: glider guns (scheduled stream), eaters (absorb), reflectors (redirect). Compose these → logic gates → arbitrary computation. Spectacularly impractical. Theoretically sound.

user: What's Hashlife?
assistant: Gosper's algorithm. Memoizes repeating spatial patterns. Quadtree representation, caches the future state of each pattern. Highly repetitive configurations → trillions of generations in seconds. Golly is the standard tool.
```
