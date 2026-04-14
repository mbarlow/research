---
title: Fourier Ocean Waves — Tessendorf's FFT Water Simulation
date: 2026-03-04
order: 32
description: Implement Jerry Tessendorf's FFT-based ocean simulation, the same technique used in film VFX at Pixar and Weta, running in real time with Three.js.
tags: [graphics, simulation, fourier, ocean, water, threejs, physics]
---

## Why Tessendorf

2001. Jerry Tessendorf publishes "Simulating Ocean Water." Becomes the definitive technique for ocean rendering in film VFX.

The insight: ocean waves are a superposition of sinusoidal components with amplitudes drawn from well-studied statistical distributions. Don't simulate fluid dynamics — synthesize the height field directly in the frequency domain, IFFT to spatial domain.

Looks physically correct because it's derived from the same oceanographic spectra measured in real oceans.

This powered the water in Titanic, Pirates, Moana, and virtually every film with realistic ocean since 2001. Standard in Unreal, Unity, custom engines.

The math is elegant. Phillips spectrum models wave energy as a function of wind speed and direction. Gerstner displacement adds the sharp peaks and broad troughs that make ocean waves look real instead of like a gentle sine wave.

GPU makes this trivial. Entire height field in a vertex shader, summing Gerstner components. Zero CPU per frame.

> [!note]
> Gerstner waves (1804) predate Fourier analysis of ocean waves by over a century. Heinrich Gerstner derived the trochoid shape from first principles — particles move in circles, the surface traces a cycloid. His displacement formula is still used because it naturally produces sharp crests and flat troughs without nonlinear fluid simulation.

## Phillips spectrum

Models wave energy distribution as a function of wave vector k:

```
P(k) = A * exp(-1 / (kL)^2) / k^4 * |k_hat . w_hat|^2
```

- **k** — wave vector (direction + spatial frequency)
- **L** = V²/g (largest wave from wind speed V)
- **w** — wind direction
- **A** — global amplitude scale

```javascript
function phillipsSpectrum(kx, kz, windSpeed, windDir) {
  const kLen = Math.sqrt(kx * kx + kz * kz);
  if (kLen < 0.001) return 0;
  const L = windSpeed * windSpeed / 9.81;
  const kNorm = [kx / kLen, kz / kLen];
  const kDotW = kNorm[0] * windDir[0] + kNorm[1] * windDir[1];
  const phillips = Math.exp(-1.0 / (kLen * L) ** 2)
                   / (kLen ** 4) * (kDotW ** 2);
  return Math.sqrt(phillips);
}
```

Waves aligned with wind get max energy. Perpendicular waves get none. Creates the directional spread of real ocean waves.

## Gerstner displacement

Each wave component displaces the surface vertically (height) and horizontally (chop):

```glsl
// In vertex shader — sum over all wave components
for (int i = 0; i < NUM_WAVES; i++) {
  float phase = dot(waveDir[i], pos.xz) * freq[i] + time * freq[i];
  float s = sin(phase);
  float c = cos(phase);

  // Horizontal displacement (makes waves lean)
  pos.x -= steepness * amp[i] * waveDir[i].x * s;
  pos.z -= steepness * amp[i] * waveDir[i].y * s;

  // Vertical displacement
  pos.y += amp[i] * c;
}
```

Steepness Q controls lean. Q = 0 → pure sinusoidal bumps. Q = 1/(wA·N) → max steepness before waves self-intersect. In between → realistic peaked shape.

## Analytical normals

Better than finite differences:

```glsl
vec3 tangent = vec3(1, 0, 0);
vec3 bitangent = vec3(0, 0, 1);

for (int i = 0; i < NUM_WAVES; i++) {
  float wa = freq[i] * amp[i];
  float phase = dot(waveDir[i], pos.xz) * freq[i] + time;
  float s = sin(phase);
  float c = cos(phase);

  tangent.x -= Q * waveDir[i].x * waveDir[i].x * wa * c;
  tangent.y += waveDir[i].x * wa * (-s);
  bitangent.z -= Q * waveDir[i].y * waveDir[i].y * wa * c;
  bitangent.y += waveDir[i].y * wa * (-s);
}

vec3 normal = normalize(cross(bitangent, tangent));
```

## Shading

Realistic water combines:

1. **Fresnel** — more reflective at grazing angles (Schlick)
2. **Sky reflection** — reflected view direction samples a sky gradient
3. **Deep color** — dark blue-green for refracted light absorbed by depth
4. **Specular** — tight sun highlight on crests
5. **Subsurface scattering** — green glow through thin crests

## Demo

24 Gerstner components, Phillips amplitudes. Camera at a low angle to show wave peaks and the interaction between specular and Fresnel.

<div data-scene="ocean-fft.js" style="width:100%;height:420px;"></div>

## Common questions

```chat
user: Why sum Gerstner waves instead of doing the full FFT?
assistant: At 24 components the direct sum is cheaper than the FFT. The FFT pays off at hundreds or thousands of components — ripples, capillary waves, foam-inducing steepness. 24 gives you the major features (swells, chop, directional spread) without the FFT infrastructure. Production: 256×256 or 512×512 FFT grids, thousands of frequency components.

user: How do you add foam?
assistant: Foam appears where waves are steep enough to break. The Jacobian of the Gerstner displacement tells you where the surface is compressing (crests converging). When det(Jacobian) drops below zero, the surface self-intersected — foam appears. Accumulate a foam texture at negative-Jacobian points, slow decay. Render as a bright, rough overlay on the water material.

user: Can this handle shorelines?
assistant: Not directly. Tessendorf is open deep water — depth effectively infinite. Near shore, waves slow, rise, refract, break. Shallow water needs either a separate simulation (shallow water equations) or analytical modifications to Gerstner parameters based on local depth. Most games blend between Tessendorf deep water and a separate shore system.

user: Performance? All in vertex shader?
assistant: Yes. CPU does zero wave computation per frame. 24 components × 128×128 grid (16K vertices) → 60fps on integrated graphics. Bottleneck for larger wave counts is the vertex shader ALU. Production uses compute shaders for the FFT on a texture, vertex shader samples it. Scales to millions of components.
```
