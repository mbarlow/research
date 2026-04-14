---
title: Strange Attractors — Visualizing Chaotic Systems
date: 2026-03-02
order: 25
description: Simulate and render strange attractors (Lorenz, Rössler, Aizawa) as particle traces in 3D, exploring deterministic chaos and sensitive dependence.
tags: [math, chaos, attractors, simulation, visualization, generative-art, threejs]
---

## Why strange attractors

Deterministic chaos: systems governed by exact equations that produce behavior indistinguishable from randomness.

Strange attractors are the geometric signatures. Sets in phase space that trajectories spiral toward but never repeat exactly. Fractal structure. Infinite detail. A haunting aesthetic that made them icons of math and generative art.

Lorenz discovered the first one in 1963 modeling atmospheric convection. Rounding an initial condition from six decimals to three produced a completely different trajectory after a few simulated days.

That's the butterfly effect. Sensitive dependence on initial conditions. Chaos's hallmark. Lorenz is its poster child.

> [!note]
> Chaotic systems are deterministic. Exact initial conditions → perfectly predictable trajectory. Chaos arises because any measurement error, however small, grows exponentially. Long-term prediction is impossible even though short-term behavior is governed exactly.

## Lorenz

Three coupled ODEs:

```
dx/dt = σ(y - x)
dy/dt = x(ρ - z) - y
dz/dt = xy - βz
```

Classic params σ = 10, ρ = 28, β = 8/3 produce the famous butterfly. The trajectory never crosses itself, never repeats, never escapes. Orbits between two lobes, switching unpredictably.

```javascript
function lorenzStep(x, y, z, sigma, rho, beta, dt) {
  const dx = sigma * (y - x);
  const dy = x * (rho - z) - y;
  const dz = x * y - beta * z;
  return [x + dx * dt, y + dy * dt, z + dz * dt];
}
```

Forward Euler. Works for visualization because small errors just create slightly different trajectories — and all trajectories on the attractor are equally valid. For quantitative work, use RK4.

## Rössler

Otto Rössler, 1976. The simplest possible chaotic attractor. One nonlinear term (xz):

```
dx/dt = -y - z
dy/dt = x + ay
dz/dt = b + z(x - c)
```

a = 0.2, b = 0.2, c = 5.7. Trajectory spirals outward in the xy-plane, occasionally makes large excursions in z, falls back. Looks like a folded ribbon.

```javascript
function rosslerStep(x, y, z, a, b, c, dt) {
  const dx = -y - z;
  const dy = x + a * y;
  const dz = b + z * (x - c);
  return [x + dx * dt, y + dy * dt, z + dz * dt];
}
```

## Aizawa

Torus-like with chaotic whiskers:

```
dx/dt = (z - b)x - dy
dy/dt = dx + (z - b)y
dz/dt = c + az - z³/3 - (x² + y²)(1 + ez) + fzx³
```

a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1. Mushroom-cap with tendrils spiraling off the edges. Less famous than Lorenz or Rössler but visually striking.

## Integration

Visualization: Euler is enough.

```javascript
// Euler: simplest, O(dt) error per step
[x, y, z] = step(x, y, z, params, dt);
```

Quantitative work: RK4. O(dt⁴) error.

```javascript
function rk4Step(x, y, z, params, dt, stepFn) {
  const k1 = stepFn(x, y, z, params, dt);
  const k2 = stepFn(
    x + k1[0] * 0.5, y + k1[1] * 0.5, z + k1[2] * 0.5, params, dt
  );
  const k3 = stepFn(
    x + k2[0] * 0.5, y + k2[1] * 0.5, z + k2[2] * 0.5, params, dt
  );
  const k4 = stepFn(
    x + k3[0], y + k3[1], z + k3[2], params, dt
  );
  return [
    x + (k1[0] + 2*k2[0] + 2*k3[0] + k4[0]) / 6,
    y + (k1[1] + 2*k2[1] + 2*k3[1] + k4[1]) / 6,
    z + (k1[2] + 2*k2[2] + 2*k3[2] + k4[2]) / 6,
  ];
}
```

> [!tip]
> For attractors, integrator choice matters less than you'd think. The attractor is a global geometric structure — all trajectories converge regardless of integration error. Euler with small dt (0.005) looks identical to RK4. Where it matters: Lyapunov exponents, tracking specific divergences.

## Demo

Six particles. Three attractors (Lorenz, Rössler, Aizawa), switching every 12s. Each particle starts from a slightly different IC — they diverge despite nearly identical starting points. Trails use additive blending.

<div data-scene="strange-attractor.js" style="width:100%;height:420px;"></div>

## Sensitive dependence

The defining feature. Two particles at (0.1, 0, 0) and (0.1001, 0, 0) on the Lorenz attractor. Initially they track. After a few hundred steps, they diverge completely — one orbits the left lobe, the other the right.

The divergence rate is the **Lyapunov exponent**. Positive = chaos. Negative = convergence. Zero = neutral.

```javascript
// Compute divergence between two nearby trajectories
let [x1, y1, z1] = [0.1, 0, 0];
let [x2, y2, z2] = [0.1001, 0, 0];

for (let i = 0; i < 5000; i++) {
  [x1, y1, z1] = lorenzStep(x1, y1, z1, 10, 28, 8/3, 0.005);
  [x2, y2, z2] = lorenzStep(x2, y2, z2, 10, 28, 8/3, 0.005);
}

const dist = Math.sqrt((x2-x1)**2 + (y2-y1)**2 + (z2-z1)**2);
// dist ≈ 20-40 (the full diameter of the attractor)
// from an initial separation of 0.0001
```

## Gallery

| Attractor | Year | Equations | Character |
|---|---|---|---|
| Lorenz | 1963 | 3 ODEs, 2 nonlinear | Butterfly wings |
| Rössler | 1976 | 3 ODEs, 1 nonlinear | Folded ribbon |
| Aizawa | 1990 | 3 ODEs, multiple nonlinear | Mushroom with tendrils |
| Chen | 1999 | Modified Lorenz | Denser butterfly |
| Thomas | 1999 | Cyclically symmetric | Three-lobed symmetric |
| Halvorsen | 1990s | Cyclically symmetric | Knotted loops |
| Dadras | 2010 | 5 parameters | Multi-scroll |
| Sprott | Various | Minimal polynomial | Diverse minimal forms |

## Common questions

```chat
user: What makes an attractor "strange"?
assistant: Two properties. Fractal dimension (non-integer — Lorenz is ~2.06). And sensitive dependence — trajectories diverge exponentially. A regular attractor like a limit cycle is a closed curve with integer dimension (1). Strange attractors have infinite folding and stretching → non-integer dimension and exponential divergence.

user: Can you hear chaos?
assistant: Yes. Map x, y, or z to audio frequency or amplitude. Sound that's tonal but never repeating — between noise and music. Lorenz produces a distinctive warbling between two pitch centers. Sonification of chaotic systems is an active area in both art and data exploration.

user: What about the double pendulum?
assistant: The classic mechanical chaos. 4D phase space (two angles, two angular velocities). Sufficient energy → strange attractor. Equations of motion are more complex (trig + coupled nonlinear), but the visualization is identical — integrate, plot.

user: How do bifurcation diagrams relate?
assistant: They show how the attractor changes as you vary a parameter. For Lorenz, varying ρ from 0 → 30 shows transition from fixed point (ρ < 24.74) to chaotic attractor (ρ ≈ 28). Periodic at some values, chaotic at others. The diagram plots visited states vs parameter, revealing the structure of these transitions.
```
