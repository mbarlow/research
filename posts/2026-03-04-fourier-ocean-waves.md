---
title: Fourier Ocean Waves — Tessendorf's FFT Water Simulation
date: 2026-03-04
order: 32
description: Implement Jerry Tessendorf's FFT-based ocean simulation, the same technique used in film VFX at Pixar and Weta, running in real time with Three.js.
tags: [graphics, simulation, fourier, ocean, water, threejs, physics]
---

## Why Fourier Ocean Waves

In 2001, Jerry Tessendorf published "Simulating Ocean Water," a paper that became the definitive technique for ocean rendering in film VFX. The insight: ocean waves are a superposition of sinusoidal components with amplitudes drawn from well-studied statistical distributions. Rather than simulating fluid dynamics (expensive, hard to control), you synthesize the height field directly in the frequency domain and transform it to spatial domain with an inverse FFT. The result looks physically correct because it's derived from the same oceanographic spectra measured in real oceans.

This technique powered the water in Titanic, Pirates of the Caribbean, Moana, and virtually every film with realistic ocean since 2001. It's also the standard in game engines — Unreal, Unity, and custom engines all offer Tessendorf-based ocean systems. The math is elegant: the Phillips spectrum models wave energy as a function of wind speed and direction, and Gerstner wave displacement adds the characteristic sharp peaks and broad troughs that make ocean waves look real rather than like a gentle sine wave.

The GPU makes this trivial. The entire height field can be computed in a vertex shader by summing Gerstner wave components, with no CPU work per frame. For higher quality, compute shaders run the FFT directly on the GPU.

> [!note]
> Gerstner waves (1804) predate Fourier analysis of ocean waves by over a century. Heinrich Gerstner derived the trochoid shape of deep-water waves from first principles — particles move in circles, and the surface traces a cycloid. His displacement formula is still used because it naturally produces sharp crests and flat troughs without any nonlinear fluid simulation.

## Post Plan (Feature Map)

| Section Goal | Blog Feature Used | Why |
|---|---|---|
| Explain the Tessendorf approach | Text | Why frequency-domain synthesis works |
| Cover the Phillips spectrum | Code + math | The physics of wave energy distribution |
| Show Gerstner wave displacement | Code blocks | The vertex shader implementation |
| Cover normal computation | Code blocks | Analytical normals from wave derivatives |
| Interactive demo | Three.js scene embed | Real-time ocean rendering |
| Address questions | Chat transcript | FFT vs. sum, performance, foam |

## The Phillips Spectrum

The Phillips spectrum models the energy distribution of ocean waves as a function of wave vector **k**:

```
P(k) = A * exp(-1 / (kL)^2) / k^4 * |k_hat . w_hat|^2
```

Where:
- **k** = wave vector (direction and spatial frequency)
- **L** = V^2/g (largest wave from wind speed V)
- **w** = wind direction
- **A** = global amplitude scale

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

Waves aligned with the wind get maximum energy. Perpendicular waves get none. This creates the characteristic directional spread of real ocean waves.

## Gerstner Wave Displacement

Each wave component displaces the surface both vertically (height) and horizontally (choppy displacement):

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

The steepness parameter Q controls how much waves lean. Q = 0 gives pure sinusoidal bumps. Q = 1/(wA*N) gives maximum steepness before waves self-intersect. Values in between produce the realistic peaked shape.

## Analytical Normals

Computing normals from the Gerstner equations directly (rather than from finite differences) gives smooth, accurate surface normals:

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

## Water Shading

Realistic water shading combines several effects:

1. **Fresnel**: water is more reflective at grazing angles (Schlick approximation)
2. **Sky reflection**: reflected view direction samples a sky gradient
3. **Deep color**: dark blue-green for refracted light absorbed by depth
4. **Specular**: tight sun highlight on the wave crests
5. **Subsurface scattering**: green glow where light passes through thin wave crests

## Interactive Demo

24 Gerstner wave components with Phillips spectrum amplitudes create a realistic open ocean. The camera orbits at a low angle to emphasize the wave peaks and the interaction between specular highlights and Fresnel reflections.

<div data-scene="ocean-fft.js" style="width:100%;height:420px;"></div>

## Common Questions

```chat
user: Why sum Gerstner waves instead of doing the full FFT?
assistant: For a demo with 24 wave components, the direct sum is cheaper than an FFT. The FFT approach pays off when you need hundreds or thousands of wave components for fine detail — ripples, capillary waves, foam-inducing steepness. At 24 components, you get the major visual features (swells, chop, directional spread) without the FFT infrastructure. Production implementations typically use 256x256 or 512x512 FFT grids with thousands of frequency components.

user: How do you add foam?
assistant: Foam appears where waves are steep enough to break. The Jacobian of the Gerstner displacement tells you where the surface is being compressed (wave crests converging). When the Jacobian determinant drops below zero, the surface has self-intersected — that's where foam should appear. Store a foam texture that accumulates at negative-Jacobian points and slowly decays. Render foam as a bright, rough overlay on the water material.

user: Can this handle shorelines?
assistant: Not directly. Tessendorf waves are designed for open deep water where the depth is effectively infinite. Near shorelines, waves interact with the bottom — they slow down, increase in height, refract, and break. Shallow water requires either a separate simulation (shallow water equations) or analytical modifications to the Gerstner parameters based on local depth. Most games blend between Tessendorf deep water and a separate shore system.

user: What about performance? This is all in the vertex shader?
assistant: Yes — the CPU does zero wave computation per frame. All Gerstner displacement happens in the vertex shader. With 24 wave components and a 128x128 grid (16K vertices), this runs at 60fps easily on integrated graphics. The bottleneck for larger wave counts would be the vertex shader ALU. Production implementations use compute shaders to run the FFT on a texture, then sample that texture in the vertex shader, which scales to millions of wave components.
```
