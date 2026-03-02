---
title: Cellular Automata — Emergent Complexity from Simple Rules
date: 2026-03-02
order: 24
description: Explore cellular automata from Conway's Game of Life to 3D visualization, showing how simple local rules produce complex emergent behavior.
tags: [simulation, cellular-automata, game-of-life, emergence, generative-art, threejs]
---

## Why Cellular Automata

A cellular automaton is a grid of cells, each in one of a finite number of states, updated simultaneously according to rules that depend only on nearby neighbors. No global coordination, no central plan. Yet from this minimal setup, complex behavior emerges: self-replicating patterns, gliders that travel across the grid, Turing-complete computation, and structures that look unsettlingly biological.

John Conway's Game of Life (1970) is the most famous example, but the concept reaches back to John von Neumann and Stanislaw Ulam in the 1940s, who were trying to understand self-replication. Stephen Wolfram spent decades cataloging one-dimensional cellular automata and arguing that simple rules are sufficient to produce any computable behavior. Whether or not you buy the philosophical claims, cellular automata remain one of the purest demonstrations that complexity does not require complicated causes.

> [!note]
> Conway's Game of Life is Turing-complete. Logic gates, memory, and arbitrary computation can be constructed from gliders and glider guns. It is a universal computer — one that nobody would want to program, but the theoretical capability is there.

## Post Plan (Feature Map)

| Section Goal | Blog Feature Used | Why |
|---|---|---|
| Explain the rules | Code blocks + table | Make the birth/survival conditions explicit |
| Cover implementation | JavaScript code | Grid update with wraparound |
| Show emergent patterns | Table + callout | Gliders, oscillators, still lifes |
| Build a 3D visualization | Three.js scene embed | Game of Life with generation history stacked in 3D |
| Address practical questions | Chat transcript | Variants, performance, higher dimensions |

## The Rules

Conway's Game of Life uses a 2D grid where each cell is alive (1) or dead (0). Every generation, all cells update simultaneously based on their 8 neighbors (Moore neighborhood):

| Current State | Neighbor Count | Next State | Name |
|---|---|---|---|
| Alive | < 2 | Dead | Underpopulation |
| Alive | 2 or 3 | Alive | Survival |
| Alive | > 3 | Dead | Overpopulation |
| Dead | exactly 3 | Alive | Reproduction |

These four rules are often written as shorthand: **B3/S23** (Birth with 3 neighbors, Survive with 2 or 3).

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

## Neighbor Counting

The Moore neighborhood includes all 8 surrounding cells. Wrapping at grid edges makes the grid toroidal -- patterns that exit one side reenter from the opposite side.

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

The double-buffer pattern (current → next, then swap) is essential. If you update cells in-place, later cells see already-updated neighbors and the simulation breaks. This is the same ping-pong pattern used in the reaction-diffusion post, but on the CPU side.

## Emergent Structures

From the four rules above, these structures emerge without being designed:

| Pattern | Type | Behavior |
|---|---|---|
| **Block** (2x2 square) | Still life | Never changes |
| **Beehive** | Still life | Stable hexagonal shape |
| **Blinker** (3 in a row) | Oscillator | Toggles between horizontal and vertical, period 2 |
| **Pulsar** | Oscillator | Complex 13x13 pattern, period 3 |
| **Glider** | Spaceship | Moves diagonally one cell every 4 generations |
| **LWSS** | Spaceship | Lightweight spaceship, moves horizontally |
| **Gosper Glider Gun** | Gun | Emits a new glider every 30 generations |
| **R-pentomino** | Methuselah | 5 cells that take 1103 generations to stabilize |

> [!tip]
> The R-pentomino is the classic demonstration of sensitive dependence in cellular automata. Five cells. Over a thousand generations of chaotic evolution before settling into a stable configuration of still lifes, oscillators, and escaped gliders.

## Wolfram's Elementary Automata

Before Life, there are the 1D cellular automata that Wolfram classified. A single row of cells, each looking at itself and its two neighbors (3 cells = 8 possible configurations), producing one of 2^8 = 256 possible rules. Each rule number encodes the output for all 8 input patterns:

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

**Rule 30** produces chaotic, random-looking output from a single cell. **Rule 110** is proven Turing-complete. **Rule 90** produces the Sierpinski triangle. All from a single byte specifying the rule.

## 3D Visualization

The demo below runs Conway's Game of Life on a 40x40 grid. The current generation is shown at the top, and the previous 12 generations are stacked below it as translucent layers, creating a 3D history of the simulation. Cells are rendered as instanced cubes for performance. When the pattern stagnates or dies, the grid reseeds automatically.

<div data-scene="cellular-automata.js" style="width:100%;height:420px;"></div>

## GPU Implementation

For larger grids, move the simulation to the GPU using the same ping-pong framebuffer technique from reaction-diffusion:

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

This handles grids of 1024x1024+ at 60fps easily. The texture lookup handles the neighbor sampling, and the GPU processes all cells in parallel.

## Notable Variants

| Rule | Birth/Survival | Character |
|---|---|---|
| **B3/S23** (Life) | Classic | Balanced chaos and stability |
| **B36/S23** (HighLife) | Replicator | Has a small self-replicating pattern |
| **B3678/S34678** (Day & Night) | Symmetric | Dead and alive cells are interchangeable |
| **B1/S12** (Seeds) | Explosive | Everything explodes into chaos |
| **B2/S** (Seeds variant) | Chaotic | Patterns die quickly but produce bursts |
| **B368/S245** | Organic | Slow, amoeba-like growth |

## Common Questions

```chat
user: How do I make the grid larger without killing performance?
assistant: On the CPU, a 100x100 grid runs fine in JavaScript. Beyond that, move to the GPU shader approach. A 1024x1024 grid on the GPU runs at 60fps because every cell is processed in parallel. For the 3D visualization with instanced cubes, the bottleneck is rendering thousands of instances — use InstancedMesh and only allocate instances for alive cells, not the full grid. Frustum culling and LOD help for very large grids.

user: What about 3D cellular automata?
assistant: 3D Life variants exist. The most common uses a 26-neighbor Moore neighborhood (3x3x3 cube minus center). Rules like B5/S4 and B6/S567 produce interesting 3D structures — crystals, tunnels, pulsating blobs. The challenge is visualization: you cannot see the interior of a 3D grid without cross-sections or transparency. Marching cubes can extract an isosurface from the alive-cell density field.

user: Is Life really Turing-complete?
assistant: Yes, proven rigorously. Paul Rendell constructed a Turing machine in Life in 2000, and since then much more compact constructions have been found. The key components are: glider guns (produce a stream of gliders on a schedule), eaters (absorb gliders), and reflectors (redirect gliders). By arranging these components, you can build logic gates, and from logic gates, arbitrary computation. It is spectacularly impractical but theoretically sound.

user: What is Hashlife?
assistant: Hashlife is Bill Gosper's algorithm for accelerating Life simulation by memoizing repeating spatial patterns. It represents the grid as a quadtree and caches the future state of each pattern. For highly repetitive configurations, Hashlife can simulate trillions of generations in seconds. The Golly application implements it and is the standard tool for serious Life research.
```
