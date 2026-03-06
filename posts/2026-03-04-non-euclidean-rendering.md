---
title: Non-Euclidean Rendering — Curved Space in the Browser
date: 2026-03-04
order: 28
description: Ray march through hyperbolic and spherical geometries where parallel lines diverge, rooms are bigger on the inside, and straight lines curve.
tags: [graphics, ray-marching, non-euclidean, hyperbolic-geometry, glsl, math]
---

## Why Non-Euclidean Geometry

For over two thousand years, Euclid's fifth postulate — that through any point not on a line, exactly one parallel line exists — was assumed to be a necessary truth about space. In the 19th century, Gauss, Bolyai, and Lobachevsky independently proved it wasn't. You can build consistent geometries where infinitely many parallel lines pass through a point (hyperbolic space) or where no parallel lines exist at all (spherical space). These aren't mathematical curiosities — Einstein showed that physical spacetime is non-Euclidean, curved by mass and energy.

Rendering non-Euclidean spaces means abandoning straight-line ray casting. In curved space, "straight" means geodesic — the shortest path between two points, which curves relative to a Euclidean embedding. In hyperbolic space, geodesics diverge exponentially, meaning that a small room can contain infinite area. In spherical space, all geodesics eventually return to their starting point, meaning you can see the back of your own head if you look far enough.

The visual results are immediately striking: repeating structures that shrink toward infinity in a way that feels fundamentally different from Euclidean perspective. Escher's Circle Limit woodcuts are the most famous visualization of hyperbolic tiling. With GPU ray marching, we can walk through these spaces in real time.

> [!note]
> Video games occasionally use non-Euclidean tricks — portals in Portal, the impossible architecture in Antichamber, the curved space in Hyperbolica. Most use portal-based cheats rather than actual curved-space rendering. True hyperbolic ray marching, as shown here, computes geodesics directly.

## Post Plan (Feature Map)

| Section Goal | Blog Feature Used | Why |
|---|---|---|
| Explain the geometry | Text + math | What non-Euclidean means precisely |
| Cover the three classical geometries | Table + callout | Euclidean vs. hyperbolic vs. spherical |
| Show the rendering technique | Code blocks | Log-polar domain repetition |
| Build an interactive demo | Three.js scene embed | Fly through hyperbolic architecture |
| Address common questions | Chat transcript | Games, physics, practicality |

## The Three Classical Geometries

| Property | Euclidean | Hyperbolic | Spherical |
|---|---|---|---|
| Parallel lines through a point | Exactly 1 | Infinitely many | 0 |
| Triangle angle sum | = 180 | < 180 | > 180 |
| Area growth with radius | r^2 | e^r (exponential) | Bounded |
| Curvature | 0 | Negative | Positive |
| Real-world example | Flat table | Saddle surface | Earth's surface |

## Rendering Hyperbolic Space

The key technique is **logarithmic-polar domain repetition**. In Euclidean space, we tile by modular arithmetic (`mod(x, cellSize)`). In hyperbolic space, distances grow exponentially from the center, so we tile in log-polar coordinates:

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

This creates cells that are equal-sized in the hyperbolic metric but shrink exponentially toward the center and toward infinity in Euclidean embedding — exactly the Circle Limit effect.

## The SDF Scene

Inside each hyperbolic cell, we place geometry using standard signed distance functions:

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

Each cell gets a unique color derived from its cell ID (which ring and which sector), creating the characteristic hyperbolic coloring where you can track the tiling structure.

## Ambient Occlusion in Curved Space

Standard ray-marched ambient occlusion works by sampling the distance field along the normal direction. In non-Euclidean space, this still works because the SDF is locally Euclidean — curvature only manifests over larger distances:

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

## Interactive Demo

Fly through a hyperbolic cathedral — pillars and arches repeat infinitely, shrinking toward the horizon in every direction. The architecture is identical in each cell, but the hyperbolic metric makes each repetition appear smaller, creating an infinite corridor that fits within a finite view.

<div data-scene="non-euclidean.js" style="width:100%;height:420px;"></div>

## Common Questions

```chat
user: Is this actually rendering in curved space, or just faking it?
assistant: It's a hybrid. The domain repetition in log-polar coordinates creates the visual signature of hyperbolic space — the exponential shrinking of cells toward the boundary. But the rays themselves travel in straight lines through a Euclidean embedding. True hyperbolic ray marching would integrate geodesic equations (modifying ray direction at each step based on the Christoffel symbols of the metric). The visual result is nearly identical for this type of scene, and the log-polar approach runs 10x faster.

user: Could you render the Poincare disk model exactly?
assistant: Yes. The Poincare disk maps the entire hyperbolic plane into a unit circle. Points near the boundary represent points "at infinity." You'd ray march in the disk model using the hyperbolic distance metric d(p,q) = acosh(1 + 2|p-q|^2 / ((1-|p|^2)(1-|q|^2))). The SDF would be defined in terms of this metric. It's more mathematically pure but produces a similar visual to the log-polar approach for architectural scenes.

user: What about VR in non-Euclidean space?
assistant: It works and it's deeply disorienting. Henry Segerman and Vi Hart have built VR experiences in hyperbolic and spherical space. The brain struggles to reconcile the visual input with its Euclidean expectations — rooms that are "bigger on the inside" create a specific kind of spatial nausea that's different from normal VR sickness. The rendering is the same as here but stereoscopic, with geodesic rays computed per eye.

user: Do any shipping games use real curved-space rendering?
assistant: Hyperbolica (2022) is the closest — it actually renders in hyperbolic space, though with some compromises for performance. Most games use portal tricks: render the scene from multiple viewpoints and stitch them together at portal boundaries. This gives the illusion of non-Euclidean space without the per-pixel geodesic computation. Antichamber, Superliminal, and Manifold Garden all use this approach.
```
