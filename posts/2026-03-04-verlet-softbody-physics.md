---
title: Verlet Integration Softbody Physics — Jelly, Cloth, and Rope
date: 2026-03-04
order: 36
description: Build a softbody physics engine using Verlet integration and distance constraints, simulating jelly cubes, cloth sheets, and swinging ropes in real time.
tags: [physics, simulation, verlet, softbody, threejs, creative-coding]
---

## Why Verlet Integration

Most physics simulations store position and velocity. Euler integration updates them: `v += a*dt; x += v*dt`. It's simple but fragile — constraints (fixed distances between particles) require velocity corrections that fight the integrator and cause jitter. Verlet integration sidesteps this by storing position and previous position. Velocity is implicit: `v = x_current - x_previous`. The update is:

```
x_new = 2 * x_current - x_previous + acceleration * dt^2
```

Why is this better? Constraints modify positions directly. After integration, you move particles to satisfy distance constraints, and the implicit velocity automatically adjusts — no explicit velocity correction needed. This makes Verlet ideal for systems with many constraints: cloth, rope, softbodies, ragdolls, bridges.

Thomas Jakobsen's 2001 GDC talk "Advanced Character Physics" popularized this approach for games. The same technique powers everything from the cloth in Hitman to the bridges in Poly Bridge to the ragdolls in Overgrowth. It's simple enough to implement in an afternoon and stable enough for production use.

The entire engine fits in about 50 lines: integrate positions, solve constraints iteratively, handle collisions. No matrix inversions, no implicit solvers, no conjugate gradient. Just move particles and enforce distances.

> [!note]
> Verlet integration is a symplectic integrator — it exactly conserves a quantity close to the total energy (a "shadow Hamiltonian"). This is why Verlet simulations don't gain or lose energy over time, unlike Euler integration which either explodes (forward Euler) or damps (backward Euler). The long-term stability is why Verlet is also the standard integrator in molecular dynamics simulations.

## Post Plan (Feature Map)

| Section Goal | Blog Feature Used | Why |
|---|---|---|
| Explain Verlet integration | Text + math | Position-based dynamics |
| Show constraint solving | Code blocks | Distance constraint iteration |
| Build three objects | Code blocks | Jelly, cloth, rope |
| Cover collision handling | Code blocks | Floor bounce |
| Interactive demo | Three.js scene embed | All three running simultaneously |
| Address questions | Chat transcript | Stiffness, GPU, more shapes |

## The Integration Step

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

## Distance Constraints

Each constraint enforces a fixed distance between two particles. If the actual distance differs from the rest length, move both particles equally toward (or away from) each other:

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

More iterations = stiffer material. 1-2 iterations gives jelly-like softness. 6-8 iterations gives cloth-like behavior. 20+ iterations approaches rigid-body behavior.

## Building a Cloth

A cloth is a 2D grid of particles with structural constraints (horizontal and vertical neighbors) and shear constraints (diagonal neighbors):

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

## Building a Jelly Cube

A jelly cube is a 3D grid with structural constraints along all three axes, plus face diagonal constraints for shear resistance:

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

## Floor Collision

Simple floor plane collision with bounce:

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

## Interactive Demo

Three softbody objects side by side: a jelly cube (left, green wireframe) that periodically bounces, a cloth sheet (center, blue) hanging from pinned points and billowing in simulated wind, and a rope (right, orange) swinging freely. All use the same Verlet engine. Orbit the camera to view from any angle.

<div data-scene="verlet-softbody.js" style="width:100%;height:420px;"></div>

## Common Questions

```chat
user: How do you make the cloth stiffer?
assistant: Three approaches. First, increase constraint iterations — more iterations means the constraint solver converges closer to the exact solution. Second, use smaller substeps (run the simulation 3-4 times per frame with a smaller dt). Third, add "bend" constraints that skip one particle (connecting every other particle), which resist folding. In practice, 6-8 iterations with 2-3 substeps gives good cloth behavior.

user: Can this run on the GPU?
assistant: Yes, and it's the standard approach for large particle counts. Position-based dynamics maps naturally to compute shaders — the integration step is embarrassingly parallel, and constraint solving uses a Jacobi-style parallel relaxation (each constraint writes half the correction to each particle, then you average). The main challenge is the constraint graph coloring — constraints that share particles can't be solved simultaneously, so you need to partition them into independent sets. NVIDIA's Flex library does this.

user: What about self-collision?
assistant: Self-collision (cloth folding through itself) is the hardest part of cloth simulation. The simplest approach is spatial hashing — hash particle positions into a grid and check nearby particles for overlap. When two non-connected particles are too close, push them apart with a distance constraint. The cost is O(n) with spatial hashing but the constant factor is high. Production cloth solvers use continuous collision detection (checking if triangles intersect between timesteps) for robustness.

user: Why not just use a physics library like Cannon.js or Ammo.js?
assistant: For learning and for specific softbody effects, rolling your own Verlet engine is better. Physics libraries are designed for rigid bodies and joints — their softbody support is usually an afterthought. A custom Verlet engine gives you direct control over constraint topology, iteration count, damping, and collision response. It's also much simpler to debug. For a game with mixed rigid and soft bodies, a full library makes sense. For a focused softbody demo like this, 50 lines of custom code beats a 500KB library.
```
