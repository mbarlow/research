---
title: Boids on Curved Manifolds — Flocking on a Torus
date: 2026-03-04
order: 33
description: Simulate Reynolds' flocking algorithm on curved surfaces where topology wraps, twists, and changes the meaning of "nearby" — boids on a torus, sphere, and Klein bottle.
tags: [simulation, boids, flocking, topology, threejs, math, creative-coding]
---

## Boids in non-flat space

Reynolds' 1987 boids algorithm: complex flocking from three rules. Separation, alignment, cohesion. Reynolds' implementation lived in flat Euclidean space — infinite plane, straightforward distance, no boundary.

Put boids on a curved surface and the dynamics change.

On a torus, "nearby" wraps around both the major and minor circles. A boid near one edge of parameter space has neighbors on the opposite side. On a sphere, no edge — but geodesic distance differs from straight-line distance through the interior. On a Klein bottle, a boid wrapping one axis comes back mirror-reflected. Left and right swap.

Topology constrains flow. Flat plane → flocks drift linearly. Torus → flocks form streams that wrap around the donut. Sphere → great-circle flows, vortices at the poles.

> [!note]
> The torus has zero Gaussian curvature (a flat plane rolled up) — boid rules transfer directly from flat space to torus parameter space. A sphere has positive curvature everywhere, so parallel transport rotates vectors — a boid's heading changes just by moving, even without steering.

## The three rules (flat)

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

## Wrapping on a torus

Parameterize by (u, v). Both wrap mod 2π. Geodesic distance accounts for the wrap.

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

Simulation runs in (u, v) parameter space. Positions and velocities are 2D. Torus radii (R major, r minor) scale distances so the geodesic metric matches surface distance.

## Render to 3D

Map (u, v) → 3D point on the surface.

```javascript
function torusPoint(u, v, R, r) {
  return new Vector3(
    (R + r * cos(v)) * cos(u),
    r * sin(v),
    (R + r * cos(v)) * sin(u)
  );
}
```

Orientation needs surface tangents:

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

3D velocity = `du * tangentU + dv * tangentV`. Tangent to the surface.

## Demo

250 boids on a torus. Wireframe shows surface. Boids flow in streams, wrapping around both circles. Color = identity. Watch for emergent vortices and streams that follow the topology.

<div data-scene="boids-manifold.js" style="width:100%;height:420px;"></div>

## Common questions

```chat
user: What happens on a sphere?
assistant: Geodesic distance becomes great-circle: `d = R * arccos(dot(p1, p2) / R²)`. Complication: poles. All longitudes converge there → singularity in (lat, lon) coords. Boids near a pole get distorted neighbor detection. Fix: work in 3D — positions and velocities as vectors on the sphere — and project velocities onto the tangent plane after each update.

user: Can boids on a Klein bottle really flip orientation?
assistant: Yes. The Klein bottle's parameter space identifies one pair of edges with a twist — when v wraps, u reflects. A boid exiting the top returns at the bottom with horizontal direction reversed. Right-turning flock becomes left-turning when it wraps. Negate the u-component of velocity when v wraps. Flocks periodically reverse their chirality.

user: How does curvature affect flocking?
assistant: Positive curvature (sphere) — geodesics converge. Initially parallel boids eventually meet. Natural focusing effect — cohesion is stronger than flat. Negative curvature (hyperbolic plane) — geodesics diverge. Flocks spread out, harder to maintain. The torus has zero Gaussian curvature (topologically flat), so dynamics are closest to flat-space boids but with the wrapping topology.

user: O(n²) — how do I scale?
assistant: Naive all-pairs is O(n²). Flat space — spatial hashing or grid → O(n). Torus — same trick in (u,v); hash cells wrap at boundaries like positions. Sphere — spherical grid or octree. 250 boids at 60fps is fine (62,500 comparisons/frame). Thousands → spatial hashing essential. Millions → GPU compute shaders parallelize the neighbor search.
```
