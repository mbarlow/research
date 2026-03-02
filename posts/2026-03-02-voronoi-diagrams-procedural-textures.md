---
title: Voronoi Diagrams — Cell-Based Procedural Textures
date: 2026-03-02
order: 23
description: Generate Voronoi patterns on the GPU using distance fields, with applications to procedural textures, organic patterns, and terrain generation.
tags: [graphics, voronoi, procedural-generation, glsl, generative-art]
---

## Why Voronoi

A Voronoi diagram partitions space into regions based on proximity to a set of seed points. Each region contains all points closer to its seed than to any other. The result is a cellular pattern that appears constantly in nature: mud cracks, giraffe spots, dragonfly wings, soap bubbles, crystal grain boundaries, and turtle shells.

For procedural generation, Voronoi is indispensable. It gives you cellular textures without painting them, organic partitioning without manual placement, and distance fields that feed into noise, erosion, and shading algorithms. The GPU implementation is fast enough for real-time use in shaders, and the math is simple -- just distance comparisons.

> [!note]
> The Voronoi diagram and its dual, the Delaunay triangulation, are two views of the same geometric structure. Any Voronoi diagram can be converted to a Delaunay triangulation by connecting seeds whose cells share an edge, and vice versa.

## Post Plan (Feature Map)

| Section Goal | Blog Feature Used | Why |
|---|---|---|
| Explain the Voronoi construction | Code blocks + math | Make the nearest-neighbor partitioning concrete |
| Cover the GPU cell trick | GLSL code + callout | The grid-based optimization is the key insight |
| Show distance field variants | Table + code | F1, F2, edge distance all have distinct visual character |
| Build an interactive demo | Three.js scene embed | Animated Voronoi with moving seeds |
| Address practical questions | Chat transcript | Handle Fortune's algorithm, Lloyd relaxation, etc. |

## The Brute Force Definition

Given N seed points, the Voronoi cell for seed i is the set of all points p where:

```
distance(p, seed_i) < distance(p, seed_j)  for all j ≠ i
```

A brute force implementation tests every pixel against every seed. This is O(N) per pixel, which is fine for 20 seeds but not for 200.

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

## The Grid Cell Optimization

The GPU-friendly approach avoids testing all seeds. Instead, tile space into a grid and place one seed point in each cell. To find the nearest seed for any point, you only need to check the 3x3 neighborhood of cells around it -- the closest seed is guaranteed to be in one of those 9 cells.

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

This is O(1) per pixel regardless of how many cells exist. The trick is that the grid structure guarantees locality -- you never need to look further than one cell away.

> [!tip]
> The `hash2` function maps cell coordinates to deterministic pseudo-random positions. Any hash works as long as it produces well-distributed values. The standard shader hash `fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453)` is fast and has adequate distribution for visual use.

## Distance Field Variants

The Voronoi construction produces several useful distance fields:

| Variant | Definition | Visual Character |
|---|---|---|
| **F1** | Distance to nearest seed | Rounded cells, organic |
| **F2** | Distance to second-nearest seed | Inverted cells, more angular |
| **F2 - F1** | Edge detection | Cell boundaries highlighted |
| **F1 * F2** | Product | Cracked, geological look |
| **F2 / F1** | Ratio | Crystalline, faceted |

To compute F2, track both the closest and second-closest distances:

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

The edge value is thin where two cells meet and thick at cell centers -- perfect for drawing cell outlines without any explicit edge geometry.

## Animating Seeds

Making the seeds move is trivial: offset the hash output with a time-dependent function:

```glsl
vec2 point = hash2(cellId);
// Smooth oscillation around the hash-determined home position
point = 0.5 + 0.4 * sin(uTime * 0.5 + 6.2831 * point);
```

The sine wrapping ensures points stay within their cells (amplitude 0.4 < 0.5), preventing topology changes that would cause visual popping.

## Interactive Demo

The scene below renders an animated Voronoi diagram in real time. Seed points drift smoothly within their cells, deforming the cell boundaries. Each cell is colored based on its seed ID, with edge lines drawn where cells meet.

<div data-scene="voronoi.js" style="width:100%;height:420px;"></div>

## Applications

Voronoi patterns feed into many procedural generation pipelines:

**Terrain**: Use Voronoi cells as tectonic plates. Elevate some plates, depress others, and erode the boundaries. The F2-F1 edge distance drives ridge and valley placement.

**Materials**: Voronoi cells at different scales produce stone, leather, reptile skin, cracked earth, and cellular foam. Layer multiple Voronoi patterns at different frequencies (like FBM with noise) for complex surfaces.

**Architecture**: Voronoi partitioning of floor plans produces organic room layouts. Lloyd relaxation (iteratively moving seeds to their cell centroids) regularizes the shapes while keeping them non-uniform.

**Game maps**: Voronoi cells make natural territory boundaries, biome regions, and shatter patterns for destruction effects.

## Common Questions

```chat
user: What is Fortune's algorithm?
assistant: Fortune's algorithm computes the exact Voronoi diagram for arbitrary point sets in O(N log N) time. It sweeps a line across the plane, maintaining a "beach line" of parabolic arcs that represent the growing Voronoi boundaries. It is the standard CPU algorithm for exact Voronoi diagrams. For shaders, the grid-cell approximation is preferred because it runs in O(1) per pixel and handles arbitrary point counts through tiling.

user: What is Lloyd relaxation?
assistant: Start with random seed points, compute the Voronoi diagram, then move each seed to the centroid of its cell. Repeat. After a few iterations, the cells become more uniform in size and shape, approaching a centroidal Voronoi tessellation. This is used in stippling (non-photorealistic rendering), mesh generation, and any application where you want even spacing without perfect regularity.

user: How does Worley noise relate to this?
assistant: Worley noise (also called cellular noise) IS the Voronoi distance field. Steven Worley published it in 1996 as a noise function. F1 Worley noise is the distance to the nearest feature point. F2 is the distance to the second nearest. The names are interchangeable -- Voronoi diagrams describe the topology (which cell am I in), and Worley noise describes the scalar field (how far am I from cell boundaries).

user: Can this work in 3D?
assistant: Yes. Replace the 2D grid with a 3D grid, the 3x3 neighborhood with a 3x3x3 neighborhood (27 cells), and use 3D hash and distance functions. The result is a 3D cellular texture that you can slice or volume-render. Common use: procedural stone, foam, sponge, and biological tissue textures.
```
