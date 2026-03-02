---
title: Mandelbulb — 3D Fractals via Ray Marching
date: 2026-03-02
order: 20
description: Render the Mandelbulb fractal in real time using ray marching, triplex algebra, and distance estimation, with an interactive GLSL viewer.
tags: [graphics, fractal, mandelbulb, ray-marching, glsl, generative-art]
---

## Why Mandelbulbs

The Mandelbrot set lives in 2D. For decades people tried to extend it into three dimensions, but complex numbers only have two components and quaternion fractals looked like lumpy potatoes. In 2009, Daniel White and Paul Nylander found a workaround: instead of extending complex algebra, they used spherical coordinates to define an n-th power operation on 3D points. The result -- the Mandelbulb -- is a genuine 3D fractal with infinite surface detail, bulbous protrusions, and recursive self-similarity at every scale.

Rendering it requires ray marching with a distance estimator, the same technique from the SDF post but applied to a fractal function. The distance estimator uses the running derivative trick to approximate how far the ray is from the fractal surface without ever computing it exactly.

> [!note]
> The Mandelbulb is technically an approximation. Unlike the 2D Mandelbrot set, it does not arise from a well-defined algebraic extension. The "triplex" power operation is a coordinate-space hack, not a true 3D complex multiplication. But it produces stunning geometry, and that is enough.

## Post Plan (Feature Map)

| Section Goal | Blog Feature Used | Why |
|---|---|---|
| Explain the triplex power formula | Code blocks + math | Make the 3D extension concrete |
| Cover distance estimation | GLSL code + callout | The DE is what makes real-time rendering possible |
| Detail the coloring approach | Code + visual | Orbit trap and iteration-based coloring |
| Provide an interactive viewer | Three.js scene embed | Real-time Mandelbulb with power oscillation |
| Address practical questions | Chat transcript | Handle the questions about performance and variants |

## The Triplex Power Formula

The Mandelbrot iteration is z = z² + c in 2D. The Mandelbulb extends this to 3D by converting to spherical coordinates, raising the angular components to a power, and converting back.

Given a point z = (x, y, z) with r = |z|, the n-th power operation is:

```
θ = acos(z / r)          // polar angle
φ = atan2(y, x)          // azimuthal angle
r^n = r^n                // radius raised to power

z^n = r^n * ( sin(nθ)cos(nφ), sin(nθ)sin(nφ), cos(nθ) )
```

The iteration is then z_{i+1} = z_i^n + c, where c is the starting point (like the Mandelbrot set). Points that stay bounded after many iterations are inside the fractal.

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

The `dr` variable tracks the derivative of the iteration with respect to the original position. This is the Hubbard-Douady potential method adapted for ray marching -- it gives you a conservative distance estimate to the fractal surface without needing to find the surface exactly.

> [!tip]
> The power parameter controls the fractal's shape. Power 8 gives the classic Mandelbulb. Lower powers (3-5) produce smoother, more alien forms. Higher powers (12+) create increasingly spiky, detailed surfaces. The demo below oscillates between 6 and 10 so you can see the shape morph.

## Distance Estimation for Ray Marching

The distance estimator is what makes real-time rendering feasible. Without it, you would need to sample billions of points to determine the surface. With it, each ray marching step can leap forward by the estimated distance, typically converging in 60-128 steps.

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

The convergence threshold (0.0005) and max distance (10.0) are tuning parameters. Tighter thresholds give sharper detail but cost more iterations. The max distance prevents wasting cycles on rays that miss the fractal entirely.

## Normals and Lighting

Since we have no mesh, normals are computed by sampling the distance field in a small neighborhood and computing the gradient:

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

This costs 6 extra distance field evaluations per pixel, but it gives smooth, accurate normals that respond to lighting. The demo uses ambient occlusion (computed by sampling the DE along the normal) and soft shadows (marching a secondary ray toward the light).

## Coloring

Fractal coloring is an art. The two main approaches:

**Iteration count**: Map the escape iteration to a color palette. Points that escape quickly get one color, points that barely escape get another. This produces the classic fractal rainbow.

**Orbit traps**: Track the minimum distance from the orbit to some geometric primitive (a point, line, or plane). This produces smoother, more organic color variation.

The demo uses a hybrid: iteration count drives the base palette (deep blue through gold to white), with position-based perturbation for spatial variation.

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

## Interactive Viewer

The scene below renders the Mandelbulb in real time using a fullscreen GLSL shader. The camera orbits slowly, and the power parameter oscillates between 6 and 10, morphing the fractal's shape continuously.

<div data-scene="mandelbulb.js" style="width:100%;height:420px;"></div>

> [!warning]
> This scene is GPU-intensive. The fragment shader evaluates the Mandelbulb distance estimator up to 128 times per pixel, with 12 iterations each. If performance is poor, your browser may be falling back to software rendering.

## Common Questions

```chat
user: Why power 8? What happens at other powers?
assistant: Power 8 is the "classic" Mandelbulb — it was the first configuration that produced visually striking 3D fractal geometry. Lower powers (2-4) give smoother, simpler shapes that look more like mutant sea creatures. Power 3 is sometimes called the "Mandelbulb cousin." Higher powers (12, 16, 20) create increasingly intricate surface detail with more lobes and branches. The demo oscillates between 6 and 10 to show this range. There is no mathematical reason to prefer 8 — it just looks the best.

user: How does this relate to the 2D Mandelbrot set?
assistant: It is an analogy, not an extension. The 2D Mandelbrot set uses genuine complex multiplication. The Mandelbulb uses a coordinate-based power operation that mimics the angular behavior of complex multiplication but does not satisfy the algebraic properties. The result shares visual DNA with the Mandelbrot set -- the same bulbous recursive forms, the same boundary complexity -- but it is a different mathematical object. There is no proven true 3D analog of the Mandelbrot set.

user: Can this run at higher resolution?
assistant: Yes, but the cost is quadratic. Doubling resolution means 4x the pixel shader invocations. The main knobs are: reduce the max ray march steps (128 → 64), reduce the Mandelbulb iterations (12 → 8), increase the convergence threshold (0.0005 → 0.001), or reduce the pixel ratio. You can also render at half resolution and upscale with bilinear filtering — fractals are forgiving because the detail is self-similar.

user: What about the Mandelbox?
assistant: The Mandelbox (discovered by Tom Lowe, 2010) is a different 3D fractal that uses a combination of box folding and sphere folding instead of the triplex power operation. It produces architectural, scaffolding-like geometry rather than organic bulbs. The rendering technique is identical — ray march with a distance estimator — but the iteration function is different. It is arguably more visually diverse than the Mandelbulb because the folding parameters create a wider range of forms.
```

## Variants Worth Exploring

Beyond the standard Mandelbulb, several related fractals use the same rendering pipeline:

| Fractal | Formula Difference | Visual Character |
|---|---|---|
| **Mandelbulb** | Spherical power operation | Organic bulbs, self-similar protrusions |
| **Mandelbox** | Box fold + sphere fold | Architectural, geometric, scaffolding |
| **Burning Ship 3D** | abs(z) before squaring | Asymmetric, more chaotic |
| **Juliabulb** | Fixed c instead of c = pos | Smoother, connected forms |
| **Power Tower** | Nested exponentials | Alien, column-like structures |

Each of these can be rendered with the same ray marching infrastructure. Only the distance estimator function changes.
