---
title: Verlet Integration Softbody Physics — Jelly, Cloth, and Rope
date: 2026-03-04
order: 36
description: Build a softbody physics engine using Verlet integration and distance constraints, simulating jelly cubes, cloth sheets, and swinging ropes in real time.
tags: [physics, simulation, verlet, softbody, threejs, creative-coding]
---

## Why Verlet

Most physics sims store position and velocity. Euler integration: `v += a*dt; x += v*dt`. Simple but fragile — constraints (fixed distances between particles) need velocity corrections that fight the integrator and cause jitter.

Verlet sidesteps this by storing position and previous position. Velocity is implicit: `v = x_current - x_previous`.

```
x_new = 2 * x_current - x_previous + acceleration * dt^2
```

Why it's better: constraints modify positions directly. After integration, you move particles to satisfy distance constraints, and the implicit velocity automatically adjusts. No explicit velocity correction.

Ideal for systems with many constraints — cloth, rope, softbodies, ragdolls, bridges.

Thomas Jakobsen's 2001 GDC talk popularized this for games. The same technique powers cloth in Hitman, bridges in Poly Bridge, ragdolls in Overgrowth. Simple enough to implement in an afternoon. Stable enough for production.

The engine fits in 50 lines. Integrate. Solve constraints iteratively. Handle collisions. No matrix inversions. No implicit solvers. No conjugate gradient. Move particles. Enforce distances.

> [!note]
> Verlet is symplectic — exactly conserves a quantity close to total energy (a "shadow Hamiltonian"). Verlet sims don't gain or lose energy over time, unlike Euler which either explodes (forward) or damps (backward). Long-term stability is also why Verlet is the standard integrator in molecular dynamics.

## Integration

```javascript
function verletStep(particles, gravity, dt, damping) {
  for (const p of particles) {
    if (p.pinned) continue;
    // Velocity from position difference
    const vx = (p.pos.x - p.prev.x) * damping;
    const vy = (p.pos.y - p.prev.y) * damping;
    const vz = (p.pos.z - p.prev.z) * damping;

    // Save current as previous
    p.prev.copy(p.pos);

    // Verlet update
    p.pos.x += vx + gravity.x * dt * dt;
    p.pos.y += vy + gravity.y * dt * dt;
    p.pos.z += vz + gravity.z * dt * dt;
  }
}
```

## Distance constraints

Each constraint enforces a fixed distance between two particles. Actual distance differs from rest length → move both equally toward (or away from) each other.

```javascript
function solveConstraints(constraints, iterations) {
  for (let iter = 0; iter < iterations; iter++) {
    for (const c of constraints) {
      const diff = c.p2.pos.clone().sub(c.p1.pos);
      const dist = diff.length();
      if (dist < 0.0001) continue;

      const correction = (dist - c.rest) / dist * 0.5;
      if (!c.p1.pinned) c.p1.pos.addScaledVector(diff, correction);
      if (!c.p2.pinned) c.p2.pos.addScaledVector(diff, -correction);
    }
  }
}
```

More iterations = stiffer. 1–2 = jelly. 6–8 = cloth. 20+ = approaches rigid body.

## Cloth

2D grid of particles. Structural constraints (horizontal + vertical neighbors). Shear constraints (diagonals).

```javascript
function buildCloth(width, height, resX, resY) {
  const particles = [];
  const constraints = [];

  for (let y = 0; y <= resY; y++) {
    for (let x = 0; x <= resX; x++) {
      const pinned = (y === 0 && x % 4 === 0);
      particles.push(new Particle(x * spacing, -y * spacing, 0, pinned));
    }
  }

  // Structural + shear constraints
  for (let y = 0; y <= resY; y++) {
    for (let x = 0; x <= resX; x++) {
      if (x < resX) addConstraint(idx(x,y), idx(x+1,y)); // horizontal
      if (y < resY) addConstraint(idx(x,y), idx(x,y+1)); // vertical
      if (x < resX && y < resY) {
        addConstraint(idx(x,y), idx(x+1,y+1)); // diagonal
        addConstraint(idx(x+1,y), idx(x,y+1)); // diagonal
      }
    }
  }
  return { particles, constraints };
}
```

## Jelly cube

3D grid. Constraints along all three axes plus face diagonals for shear resistance.

```javascript
function buildJelly(size, resolution) {
  // 3D particle grid
  for (let z = 0; z <= res; z++)
    for (let y = 0; y <= res; y++)
      for (let x = 0; x <= res; x++)
        particles.push(new Particle(x * spacing, y * spacing, z * spacing));

  // Constraints along X, Y, Z axes + face diagonals
  // No pinned particles — the cube is free to bounce
}
```

## Floor collision

Plane collision with bounce. Reflect previous position.

```javascript
function floorCollision(particles, floorY) {
  for (const p of particles) {
    if (p.pos.y < floorY) {
      p.pos.y = floorY;
      // Reflect previous position for bounce
      p.prev.y = p.pos.y + (p.pos.y - p.prev.y) * 0.3;
    }
  }
}
```

## Demo

Three softbodies side by side. Jelly cube (left, green wireframe) bouncing periodically. Cloth (center, blue) hanging from pinned points, billowing in simulated wind. Rope (right, orange) swinging freely. Same Verlet engine. Orbit the camera.

<div data-scene="verlet-softbody.js" style="width:100%;height:420px;"></div>

## Common questions

```chat
user: How do I make the cloth stiffer?
assistant: Three approaches. (1) More constraint iterations — closer to exact solution. (2) Smaller substeps — run 3–4 times per frame with smaller dt. (3) Bend constraints that skip one particle (connecting every other), resisting folding. 6–8 iterations with 2–3 substeps gives good cloth.

user: Can this run on the GPU?
assistant: Yes — standard approach for large particle counts. PBD maps naturally to compute shaders. Integration is embarrassingly parallel. Constraint solving uses Jacobi-style parallel relaxation (each constraint writes half the correction to each particle, then average). Main challenge: constraint graph coloring — constraints sharing particles can't be solved simultaneously. NVIDIA Flex does this.

user: What about self-collision?
assistant: The hardest part of cloth simulation. Simplest: spatial hashing — hash positions into a grid, check nearby particles for overlap. Non-connected particles too close → push apart with a distance constraint. O(n) with spatial hashing but high constant factor. Production solvers use continuous collision detection (checking triangle intersection between timesteps) for robustness.

user: Why not use Cannon.js or Ammo.js?
assistant: For learning and specific softbody effects, rolling your own beats a library. Physics libraries are designed for rigid bodies — softbody is usually an afterthought. Custom Verlet gives direct control over topology, iterations, damping, collision. Easier to debug. Mixed rigid + soft game → use a library. Focused softbody demo like this → 50 lines beats a 500KB library.
```
