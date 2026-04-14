---
title: Voronoi Diagrams — Cell-Based Procedural Textures
date: 2026-03-02
order: 23
description: Generate Voronoi patterns on the GPU using distance fields, with applications to procedural textures, organic patterns, and terrain generation.
tags: [graphics, voronoi, procedural-generation, glsl, generative-art]
---

## Why Voronoi

Partition space into regions by proximity to seed points. Each region contains all points closer to its seed than any other.

The result is a cellular pattern that appears constantly in nature — mud cracks, giraffe spots, dragonfly wings, soap bubbles, crystal grain boundaries, turtle shells.

For procedural generation, Voronoi is indispensable. Cellular textures without painting them. Organic partitioning without manual placement. Distance fields that feed into noise, erosion, and shading.

GPU-fast. The math is simple — distance comparisons.

> [!note]
> Voronoi and its dual (Delaunay triangulation) are two views of the same structure. Connect seeds whose cells share an edge and you get the Delaunay. Vice versa.

## Brute force

Given N seed points, the Voronoi cell for seed i is the set of all p where:

```
distance(p, seed_i) < distance(p, seed_j)  for all j ≠ i
```

Test every pixel against every seed. O(N) per pixel. Fine for 20 seeds. Not for 200.

```javascript
function voronoiBrute(x, y, seeds) {
  let minDist = Infinity;
  let closestId = -1;
  for (let i = 0; i < seeds.length; i++) {
    const dx = x - seeds[i].x;
    const dy = y - seeds[i].y;
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      closestId = i;
    }
  }
  return { dist: Math.sqrt(minDist), id: closestId };
}
```

## Grid cell trick

Tile space into a grid. One seed per cell. To find the nearest seed for any point, check only the 3×3 neighborhood — the closest seed is guaranteed to be in one of those 9 cells.

```glsl
float scale = 5.0;  // 5x5 grid of cells
vec2 p = uv * scale;
vec2 ip = floor(p);  // integer cell coordinate
vec2 fp = fract(p);  // fractional position within cell

float minDist = 10.0;

for (int y = -1; y <= 1; y++) {
  for (int x = -1; x <= 1; x++) {
    vec2 neighbor = vec2(float(x), float(y));
    vec2 cellId = ip + neighbor;

    // Hash the cell ID to get a pseudo-random seed position
    vec2 point = hash2(cellId);

    // Distance from fragment to this seed
    vec2 diff = neighbor + point - fp;
    float dist = length(diff);

    if (dist < minDist) {
      minDist = dist;
    }
  }
}
```

O(1) per pixel regardless of how many cells exist. The grid guarantees locality — never look further than one cell away.

> [!tip]
> `hash2` maps cell coords to deterministic pseudo-random positions. Standard shader hash `fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453)` is fast and adequate for visual use.

## Distance variants

Several useful fields fall out:

| Variant | Definition | Character |
|---|---|---|
| F1 | Distance to nearest seed | Rounded cells, organic |
| F2 | Distance to second-nearest | Inverted cells, more angular |
| F2 - F1 | Edge detection | Cell boundaries highlighted |
| F1 × F2 | Product | Cracked, geological |
| F2 / F1 | Ratio | Crystalline, faceted |

Track both:

```glsl
float minDist = 10.0;
float secondDist = 10.0;

// ... inside the neighbor loop:
if (dist < minDist) {
  secondDist = minDist;
  minDist = dist;
} else if (dist < secondDist) {
  secondDist = dist;
}

float edge = secondDist - minDist;  // thin at cell boundaries
```

Edge value is thin where two cells meet, thick at centers. Cell outlines without explicit edge geometry.

## Animation

Offset the hash output with time:

```glsl
vec2 point = hash2(cellId);
// Smooth oscillation around the hash-determined home position
point = 0.5 + 0.4 * sin(uTime * 0.5 + 6.2831 * point);
```

Sine wrapping keeps points within their cells (amplitude 0.4 < 0.5) — prevents topology changes that would cause visual popping.

## Demo

Animated Voronoi. Seeds drift within cells, deforming boundaries. Each cell colored by seed ID. Edge lines where cells meet.

<div data-scene="voronoi.js" style="width:100%;height:420px;"></div>

## Applications

**Terrain.** Voronoi cells as tectonic plates. Elevate some, depress others, erode boundaries. F2-F1 drives ridge and valley placement.

**Materials.** Multi-scale Voronoi → stone, leather, reptile skin, cracked earth, cellular foam. Layer at different frequencies for complex surfaces.

**Architecture.** Voronoi partitioning of floor plans → organic rooms. Lloyd relaxation regularizes shapes while keeping them non-uniform.

**Game maps.** Natural territory boundaries, biome regions, shatter patterns for destruction effects.

## Common questions

```chat
user: What's Fortune's algorithm?
assistant: Computes the exact Voronoi diagram for arbitrary point sets in O(N log N). Sweeps a line across the plane, maintaining a beach line of parabolic arcs. The standard CPU algorithm for exact Voronoi. For shaders, the grid-cell approximation wins — O(1) per pixel, arbitrary point counts via tiling.

user: What's Lloyd relaxation?
assistant: Start with random seeds. Compute Voronoi. Move each seed to its cell centroid. Repeat. Cells become more uniform in size and shape, approaching a centroidal Voronoi tessellation. Used in stippling, mesh generation, anywhere you want even spacing without perfect regularity.

user: How does Worley noise relate?
assistant: Worley noise IS the Voronoi distance field. Worley published it as a noise function in 1996. F1 = distance to nearest feature point. F2 = distance to second nearest. Names are interchangeable — Voronoi describes topology (which cell), Worley describes the scalar field (how far from boundaries).

user: Can this work in 3D?
assistant: Yes. 3D grid. 3×3×3 neighborhood (27 cells). 3D hash and distance functions. Slice or volume-render the result. Common use: procedural stone, foam, sponge, biological tissue.
```
