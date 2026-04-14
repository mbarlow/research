---
title: Non-Euclidean Rendering — Curved Space in the Browser
date: 2026-03-04
order: 28
description: Ray march through hyperbolic and spherical geometries where parallel lines diverge, rooms are bigger on the inside, and straight lines curve.
tags: [graphics, ray-marching, non-euclidean, hyperbolic-geometry, glsl, math]
---

## Why non-Euclidean

Two thousand years. Euclid's fifth postulate — through any point not on a line, exactly one parallel line exists — was assumed to be a necessary truth about space.

19th century. Gauss, Bolyai, and Lobachevsky independently proved it wasn't. You can build consistent geometries where infinitely many parallel lines pass through a point (hyperbolic) or where no parallels exist at all (spherical).

These aren't curiosities. Einstein showed physical spacetime is non-Euclidean, curved by mass and energy.

Rendering non-Euclidean spaces means abandoning straight-line ray casting. In curved space, "straight" means *geodesic* — the shortest path between two points, which curves relative to a Euclidean embedding.

In hyperbolic space, geodesics diverge exponentially — a small room can contain infinite area. In spherical space, all geodesics return to their start — you can see the back of your own head if you look far enough.

Visually: repeating structures shrink toward infinity in a way that feels fundamentally different from Euclidean perspective. Escher's Circle Limit woodcuts are the most famous visualization. With GPU ray marching, you can walk through these spaces in real time.

> [!note]
> Games occasionally use non-Euclidean tricks — Portal portals, Antichamber's impossible architecture, Hyperbolica's curved space. Most are portal-based cheats. True hyperbolic ray marching computes geodesics directly.

## The three classical geometries

| Property | Euclidean | Hyperbolic | Spherical |
|---|---|---|---|
| Parallels through a point | 1 | Infinite | 0 |
| Triangle angle sum | = 180° | < 180° | > 180° |
| Area growth with radius | r² | e^r (exponential) | Bounded |
| Curvature | 0 | Negative | Positive |
| Real-world example | Flat table | Saddle surface | Earth's surface |

## Hyperbolic rendering

The trick: **logarithmic-polar domain repetition**. Euclidean uses modular arithmetic (`mod(x, cellSize)`). Hyperbolic distances grow exponentially from the center, so we tile in log-polar coords:

```glsl
vec3 hyperbolicFold(vec3 p) {
  float r = length(p.xz);
  float theta = atan(p.z, p.x);
  float logr = log(r);

  // Repeat in log-radius and angle
  float cellSize = 0.7;
  float sectors = 7.0;
  logr = mod(logr, cellSize) - cellSize * 0.5;
  theta = mod(theta, TAU / sectors) - PI / sectors;

  // Back to Cartesian
  r = exp(logr);
  p.x = r * cos(theta);
  p.z = r * sin(theta);
  return p;
}
```

Cells are equal-sized in the hyperbolic metric. Shrink exponentially toward the center and toward infinity in Euclidean embedding. Exactly the Circle Limit effect.

## The scene

Standard SDFs inside each hyperbolic cell:

```glsl
float map(vec3 p) {
  vec3 q = hyperbolicFold(p);

  // Pillars in each cell
  float pillar = sdCylinder(q, 0.06, 0.6);

  // Floor and ceiling
  float floor = q.y + 0.6;
  float ceiling = -(q.y - 0.65);

  // Cross beams
  vec3 bq = q;
  bq.xz *= rot2(PI/4);
  float beams = sdBox(bq, vec3(0.02, 0.7, 0.02));

  return min(min(pillar, floor), min(ceiling, beams));
}
```

Each cell gets a unique color from its cell ID (ring + sector). You can track the tiling structure visually.

## AO in curved space

Standard ray-marched AO works because the SDF is locally Euclidean — curvature only manifests over larger distances:

```glsl
float calcAO(vec3 p, vec3 n) {
  float ao = 0.0;
  float scale = 1.0;
  for (int i = 0; i < 5; i++) {
    float dist = 0.02 + 0.06 * float(i);
    ao += (dist - map(p + n * dist)) * scale;
    scale *= 0.5;
  }
  return clamp(1.0 - ao * 4.0, 0.0, 1.0);
}
```

## Demo

Fly through a hyperbolic cathedral. Pillars and arches repeat infinitely, shrinking toward the horizon in every direction. Identical architecture per cell, but the hyperbolic metric makes each repetition appear smaller. Infinite corridor in a finite view.

<div data-scene="non-euclidean.js" style="width:100%;height:420px;"></div>

## Common questions

```chat
user: Is this actually rendering in curved space or just faking it?
assistant: Hybrid. Domain repetition in log-polar creates the visual signature of hyperbolic space — exponential shrinking toward the boundary. But the rays travel in straight lines through a Euclidean embedding. True hyperbolic ray marching would integrate geodesic equations (modifying direction at each step based on Christoffel symbols of the metric). Visual result is nearly identical for this type of scene. Log-polar runs 10x faster.

user: Could you render the Poincaré disk model exactly?
assistant: Yes. Poincaré disk maps the entire hyperbolic plane into a unit circle. Points near the boundary = "at infinity." Ray march in the disk model using hyperbolic distance: `d(p,q) = acosh(1 + 2|p-q|² / ((1-|p|²)(1-|q|²)))`. SDF defined in terms of this metric. More mathematically pure. Similar visual for architectural scenes.

user: What about VR in non-Euclidean space?
assistant: Works. Deeply disorienting. Henry Segerman and Vi Hart built VR experiences in hyperbolic and spherical. The brain struggles to reconcile visual input with Euclidean expectations — "bigger on the inside" rooms create a specific spatial nausea distinct from normal VR sickness. Same rendering, stereoscopic, geodesic rays per eye.

user: Do any shipping games use real curved-space rendering?
assistant: Hyperbolica (2022) is closest — actually renders in hyperbolic space with some performance compromises. Most games use portal tricks: render from multiple viewpoints, stitch at portal boundaries. Illusion without per-pixel geodesic computation. Antichamber, Superliminal, Manifold Garden all use this.
```
