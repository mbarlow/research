---
title: Boids on Curved Manifolds — Flocking on a Torus
date: 2026-03-04
order: 33
description: Simulate Reynolds' flocking algorithm on curved surfaces where topology wraps, twists, and changes the meaning of "nearby" — boids on a torus, sphere, and Klein bottle.
tags: [simulation, boids, flocking, topology, threejs, math, creative-coding]
---

## Why Boids on Manifolds

Craig Reynolds' 1987 boids algorithm demonstrated that complex flocking behavior emerges from three simple rules: separation (don't crowd), alignment (match neighbors' heading), and cohesion (steer toward the group). But Reynolds' original implementation lived in flat Euclidean space — an infinite plane where distance is straightforward and there's no boundary to worry about. What happens when you put boids on a curved surface?

On a torus, "nearby" wraps around both the major and minor circles. A boid near one edge of parameter space has neighbors on the opposite side. On a sphere, there's no edge at all, but geodesic distance (the shortest path along the surface) is different from straight-line distance through the interior. On a Klein bottle, a boid that wraps around one axis comes back mirror-reflected — its left and right are swapped.

The topology of the surface fundamentally changes the flocking dynamics. On a flat plane, flocks drift linearly. On a torus, flocks form streams that wrap around the donut, creating beautiful looping patterns. On a sphere, flocks follow great circles and form vortex-like patterns at the poles. The geometry constrains the flow in ways that produce structures you never see in flat-space simulations.

> [!note]
> The torus is the simplest non-trivially curved surface that's easy to parameterize. It has zero Gaussian curvature (like a flat plane rolled up), which means the boid rules transfer directly from flat space to torus parameter space. A sphere has positive curvature everywhere, which means parallel transport rotates vectors — a boid's heading changes just by moving, even without steering.

## Post Plan (Feature Map)

| Section Goal | Blog Feature Used | Why |
|---|---|---|
| Explain boids on flat space | Text + code | The three rules |
| Introduce manifold complications | Text + math | Geodesic distance, wrapping, curvature |
| Show torus implementation | Code blocks | Parameter space simulation |
| Cover 3D rendering | Code blocks | Mapping (u,v) to 3D positions |
| Interactive demo | Three.js scene embed | 250 boids flocking on a torus |
| Address questions | Chat transcript | Sphere, Klein bottle, performance |

## The Three Rules (Flat Space)

```javascript
for (const neighbor of nearbyBoids(boid, perceptionRadius)) {
  // Separation: steer away from too-close neighbors
  const offset = boid.pos - neighbor.pos;
  separation += offset / offset.length^2;

  // Alignment: match average heading
  alignment += neighbor.velocity;

  // Cohesion: steer toward center of mass
  cohesion += (neighbor.pos - boid.pos);
}
boid.velocity += separation * sepWeight
               + alignment * aliWeight
               + cohesion * cohWeight;
```

## Wrapping on a Torus

A torus is parameterized by (u, v) where both wrap modulo 2pi. The geodesic distance accounts for this wrapping:

```javascript
function wrapDist(a, b) {
  let d = b - a;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function geodesicDist(u1, v1, u2, v2) {
  const du = wrapDist(u1, u2);
  const dv = wrapDist(v1, v2);
  // Scale by the torus radii
  return Math.sqrt((R * du) ** 2 + (r * dv) ** 2);
}
```

The boid simulation runs entirely in (u, v) parameter space. Positions and velocities are 2D values. The torus radii (R for major, r for minor) scale the distances so that the geodesic metric matches the actual surface distance.

## Mapping to 3D

To render, map each boid's (u, v) position to a 3D point on the torus surface:

```javascript
function torusPoint(u, v, R, r) {
  return new Vector3(
    (R + r * cos(v)) * cos(u),
    r * sin(v),
    (R + r * cos(v)) * sin(u)
  );
}
```

Orientation requires the surface tangent vectors:

```javascript
function torusTangentU(u, v) {
  // Derivative of position with respect to u
  return new Vector3(-(R + r*cos(v))*sin(u), 0, (R + r*cos(v))*cos(u)).normalize();
}

function torusTangentV(u, v) {
  // Derivative of position with respect to v
  return new Vector3(-r*sin(v)*cos(u), r*cos(v), -r*sin(v)*sin(u)).normalize();
}
```

The boid's 3D velocity direction is `du * tangentU + dv * tangentV`, which gives a vector tangent to the surface.

## Interactive Demo

250 boids flock on the surface of a torus. The wireframe torus shows the surface geometry while boids flow along it in streams, wrapping around both the major and minor circles. Color encodes each boid's identity. Watch for emergent vortices and coherent streams that follow the torus topology.

<div data-scene="boids-manifold.js" style="width:100%;height:420px;"></div>

## Common Questions

```chat
user: What happens on a sphere?
assistant: On a sphere, the geodesic distance is the great-circle distance: d = R * arccos(dot(p1, p2) / R^2). The interesting complication is at the poles — all longitudes converge there, creating a singularity in the parameterization. Boids near a pole experience distorted neighbor detection if you use naive (latitude, longitude) coordinates. The fix is to work in 3D (positions and velocities as vectors on the sphere surface) and project velocities onto the tangent plane after each update.

user: Can boids on a Klein bottle really have their orientation flipped?
assistant: Yes. A Klein bottle's parameter space identifies one pair of edges with a twist — when v wraps, u is reflected. A boid that exits the top comes back at the bottom with its horizontal direction reversed. This means a right-turning flock becomes a left-turning flock when it wraps. The simulation handles this by negating the u-component of velocity when v wraps. The result is flocks that periodically reverse their chirality.

user: How does curvature affect flocking?
assistant: On surfaces with positive curvature (sphere), geodesics converge — initially parallel boids will eventually meet. This creates a natural focusing effect that makes cohesion stronger than on flat surfaces. On negative curvature (hyperbolic plane), geodesics diverge — flocks tend to spread out and are harder to maintain. The torus has zero Gaussian curvature everywhere (it's a flat torus, topologically), so the flocking dynamics are closest to flat-space boids but with the wrapping topology.

user: This is O(n^2) — how to scale it?
assistant: The naive all-pairs neighbor check is O(n^2). For flat space, spatial hashing or a grid reduces this to O(n). On a torus, you can use the same trick in (u,v) parameter space — hash cells wrap at the boundaries just like the boid positions. On a sphere, use a spherical grid or an octree. For 250 boids at 60fps, O(n^2) is fine (62,500 comparisons per frame). For thousands of boids, spatial hashing is essential. GPU compute shaders handle millions by parallelizing the neighbor search.
```
