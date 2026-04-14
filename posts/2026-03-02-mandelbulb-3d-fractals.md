---
title: Mandelbulb — 3D Fractals via Ray Marching
date: 2026-03-02
order: 20
description: Render the Mandelbulb fractal in real time using ray marching, triplex algebra, and distance estimation, with an interactive GLSL viewer.
tags: [graphics, fractal, mandelbulb, ray-marching, glsl, generative-art]
---

## Why Mandelbulbs

The Mandelbrot set lives in 2D. For decades people tried to push it into 3D. Complex numbers only have two components. Quaternion fractals looked like lumpy potatoes.

2009. Daniel White and Paul Nylander found a workaround: instead of extending complex algebra, use spherical coordinates to define an n-th power operation on 3D points.

The result — a genuine 3D fractal with infinite surface detail, bulbous protrusions, and recursive self-similarity at every scale.

Rendering needs ray marching with a distance estimator. Same technique as SDFs, applied to a fractal function. The DE uses the running derivative trick to approximate how far a ray is from the surface without finding it exactly.

> [!note]
> The Mandelbulb is technically an approximation. Unlike the 2D Mandelbrot set, it doesn't arise from a well-defined algebraic extension. The "triplex" power is a coordinate hack, not true 3D complex multiplication. But it produces stunning geometry. Enough.

## The triplex power

Mandelbrot iteration: `z = z² + c` in 2D. Mandelbulb extends it to 3D: convert to spherical coords, raise the angular components to a power, convert back.

For point z = (x, y, z) with r = |z|:

```
θ = acos(z / r)          // polar angle
φ = atan2(y, x)          // azimuthal angle
r^n = r^n                // radius raised to power

z^n = r^n * ( sin(nθ)cos(nφ), sin(nθ)sin(nφ), cos(nθ) )
```

Iteration: `z_{i+1} = z_i^n + c` where c is the starting point. Bounded after many iterations = inside the fractal.

```glsl
vec2 mandelbulb(vec3 pos, float power) {
  vec3 z = pos;
  float dr = 1.0;   // running derivative for distance estimation
  float r = 0.0;
  int iterations = 0;

  for (int i = 0; i < 12; i++) {
    iterations = i;
    r = length(z);
    if (r > 2.0) break;  // escaped — definitely outside

    // Spherical coordinates
    float theta = acos(z.z / r);
    float phi = atan(z.y, z.x);

    // Running derivative: dr = r^(n-1) * n * dr + 1
    dr = pow(r, power - 1.0) * power * dr + 1.0;

    // Apply the power operation
    float zr = pow(r, power);
    theta = theta * power;
    phi = phi * power;

    // Back to cartesian
    z = zr * vec3(
      sin(theta) * cos(phi),
      sin(theta) * sin(phi),
      cos(theta)
    );
    z += pos;  // add c
  }

  // Distance estimate: 0.5 * ln(r) * r / dr
  float dist = 0.5 * log(r) * r / dr;
  return vec2(dist, float(iterations));
}
```

`dr` tracks the derivative of the iteration with respect to original position. Hubbard-Douady potential method adapted for ray marching — gives a conservative distance estimate without finding the surface exactly.

> [!tip]
> Power 8 is the classic Mandelbulb. 3–5 = smoother, more alien. 12+ = increasingly spiky and detailed. The demo oscillates 6→10 so you can see the morph.

## DE-driven ray march

Without the DE you'd sample billions of points. With it, each step leaps forward by the estimated distance. Converges in 60–128 steps.

```glsl
// Ray march loop
float t = 0.0;
for (int i = 0; i < 128; i++) {
  vec3 pos = rayOrigin + rayDir * t;
  vec2 hit = mandelbulb(pos, 8.0);

  if (hit.x < 0.0005) break;  // close enough to surface
  if (t > 10.0) break;         // too far, give up

  t += hit.x;  // step forward by the distance estimate
}
```

Convergence threshold (0.0005) and max distance (10.0) are tuning knobs. Tighter = sharper, costlier. Max distance prevents wasted cycles on rays that miss.

## Normals + lighting

No mesh. Normals from the gradient of the distance field.

```glsl
vec3 calcNormal(vec3 pos, float power) {
  vec2 e = vec2(0.0005, 0.0);
  return normalize(vec3(
    mandelbulb(pos + e.xyy, power).x - mandelbulb(pos - e.xyy, power).x,
    mandelbulb(pos + e.yxy, power).x - mandelbulb(pos - e.yxy, power).x,
    mandelbulb(pos + e.yyx, power).x - mandelbulb(pos - e.yyx, power).x
  ));
}
```

6 extra DE evaluations per pixel. Smooth, accurate normals. The demo also uses ambient occlusion (DE samples along the normal) and soft shadows (secondary ray toward the light).

## Color

Two main approaches:

**Iteration count** — escape iteration → palette. Quick escape = one color. Barely escape = another. Classic fractal rainbow.

**Orbit traps** — track the minimum distance from the orbit to a primitive (point, line, plane). Smoother, more organic.

Demo uses a hybrid: iterations drive the palette, position perturbs for spatial variation.

```glsl
vec3 getColor(float iterations, vec3 pos) {
  float t = iterations / 12.0;
  vec3 col1 = vec3(0.05, 0.1, 0.25);   // deep blue
  vec3 col2 = vec3(0.3, 0.5, 0.9);     // mid blue
  vec3 col3 = vec3(0.9, 0.6, 0.2);     // gold
  vec3 col4 = vec3(0.95, 0.95, 0.95);  // near white

  vec3 col = mix(col1, col2, smoothstep(0.0, 0.3, t));
  col = mix(col, col3, smoothstep(0.3, 0.6, t));
  col = mix(col, col4, smoothstep(0.6, 1.0, t));

  // Position-based variation breaks up the banding
  col += 0.1 * cos(3.0 * pos.x + vec3(0.0, 1.0, 2.0));
  return col;
}
```

## Viewer

Real-time Mandelbulb. Fullscreen GLSL. Camera orbits. Power oscillates 6→10, morphing the shape continuously.

<div data-scene="mandelbulb.js" style="width:100%;height:420px;"></div>

> [!warning]
> GPU-intensive. Up to 128 marches per pixel × 12 iterations each. Poor performance? Browser may be falling back to software rendering.

## Common questions

```chat
user: Why power 8?
assistant: First configuration that produced visually striking 3D fractal geometry. Lower (2–4) = smoother, more sea-creature-like. Power 3 is the "Mandelbulb cousin." Higher (12, 16, 20) = increasingly intricate surface detail. No mathematical reason to prefer 8 — it just looks best.

user: How does this relate to the 2D Mandelbrot set?
assistant: Analogy, not extension. 2D uses genuine complex multiplication. Mandelbulb uses a coordinate-based power that mimics the angular behavior but doesn't satisfy the algebraic properties. Same visual DNA — bulbous recursive forms, boundary complexity — different mathematical object. No proven true 3D analog of the Mandelbrot set exists.

user: Can this run at higher resolution?
assistant: Yes. Cost is quadratic. Knobs: reduce max marches (128 → 64), reduce Mandelbulb iterations (12 → 8), loosen convergence threshold (0.0005 → 0.001), drop pixel ratio. Half-res + bilinear upscale also works — fractals are forgiving because detail is self-similar.

user: What about the Mandelbox?
assistant: Tom Lowe, 2010. Different 3D fractal. Box folding + sphere folding instead of triplex power. Architectural, scaffolding-like geometry instead of organic bulbs. Same rendering pipeline — DE-driven ray march. Different iteration function. Arguably more visually diverse because the folding parameters create a wider range of forms.
```

## Variants worth exploring

Same rendering pipeline. Different DE.

| Fractal | Formula | Character |
|---|---|---|
| Mandelbulb | Spherical power | Organic bulbs, self-similar protrusions |
| Mandelbox | Box fold + sphere fold | Architectural, geometric scaffolding |
| Burning Ship 3D | abs(z) before squaring | Asymmetric, more chaotic |
| Juliabulb | Fixed c instead of c = pos | Smoother, connected forms |
| Power Tower | Nested exponentials | Alien, column-like structures |
