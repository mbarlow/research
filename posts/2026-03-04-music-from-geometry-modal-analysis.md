---
title: Music From Geometry — Modal Analysis and Shape Acoustics
date: 2026-03-04
order: 29
description: Synthesize sound from 3D shapes by computing their resonant frequencies, turning geometry into musical instruments using modal analysis.
tags: [audio, physics, simulation, web-audio, threejs, math]
---

## Hear the shape

1966. Mark Kac asks: *Can one hear the shape of a drum?* Whether the resonant frequencies of a vibrating membrane uniquely determine its geometry.

The answer turned out to be no (counterexamples found in 1992). But the question revealed something profound: geometry and sound are deeply linked.

Every rigid body has a set of resonant frequencies — modes — determined by its shape, material, and boundary conditions. Strike a bell and you hear its geometry.

A cube rings differently than a sphere. A thin plate produces different harmonics than a thick bar. The relationships between modal frequencies determine whether something sounds *musical* (harmonic ratios) or *noisy* (inharmonic).

A tuning fork sounds pure. A bell sounds rich. A cymbal sounds chaotic. Different geometries → different distributions of resonant frequencies.

Web Audio gives us oscillators at arbitrary frequencies, gain envelopes for decay, real-time mixing. Three.js for visualization. Build instruments you play by clicking shapes.

> [!note]
> Eigenvalue equation for a vibrating membrane: `∇²φ = -λφ` (Helmholtz). Eigenvalues λ → resonant frequencies. Closed-form for simple shapes (rectangles, circles). FEM for arbitrary geometry.

## Harmonics by shape

| Shape | Mode ratios | Character | Example |
|---|---|---|---|
| String (1D) | 1, 2, 3, 4, 5… | Perfectly harmonic | Guitar string |
| Bar (1D, free) | 1, 2.76, 5.40, 8.93… | Inharmonic, bright | Xylophone |
| Circular membrane | 1, 1.59, 2.14, 2.30… | Inharmonic, complex | Drum head |
| Square plate | 1, 1.58, 2.0, 2.24… | Metallic, bell-like | Gong |
| Sphere (shell) | 1, 1.47, 2.09, 2.56… | Singing, bright | Singing bowl |

The insight: harmonic ratios (integer multiples) sound musical because the auditory system fuses them into a single pitch. Inharmonic ratios sound metallic or noisy because the brain can't resolve them into a single fundamental.

## Synthesis

Each mode is a damped sine. Higher modes typically decay faster. Sum.

```javascript
function strikeShape(audioCtx, frequencies, decays) {
  const now = audioCtx.currentTime;
  const master = audioCtx.createGain();
  master.gain.value = 0.15;
  master.connect(audioCtx.destination);

  frequencies.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.frequency.value = freq;
    osc.type = 'sine';

    // Higher modes have lower amplitude and faster decay
    const amp = 0.5 / (i + 1);
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + decays[i] + 0.1);
  });
}
```

For realism, add a short noise burst at onset — the attack transient with broadband impact energy:

```javascript
// Filtered noise burst for attack
const buffer = audioCtx.createBuffer(1, sampleRate * 0.05, sampleRate);
const data = buffer.getChannelData(0);
for (let i = 0; i < data.length; i++) {
  data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
}
// Bandpass filter centered on the fundamental
const filter = audioCtx.createBiquadFilter();
filter.type = 'bandpass';
filter.frequency.value = baseFreq * 2;
```

## Material

Same geometry, different material → different sound. Material affects:

1. **Frequency scaling** — stiffer → higher (Young's modulus)
2. **Decay** — denser rings longer, softer damps faster

```javascript
const MATERIALS = {
  steel:  { freqScale: 1.0, decayScale: 1.0 },
  glass:  { freqScale: 1.2, decayScale: 0.7 },
  wood:   { freqScale: 0.6, decayScale: 0.3 },
  rubber: { freqScale: 0.3, decayScale: 0.1 },
};
```

## Demo

Click any shape to strike it. Cube = metallic. Sphere = bowl. Cylinder = tubular bell. Cone = muted gong. Shapes pulse and glow.

<div data-scene="modal-sound.js" style="width:100%;height:420px;"></div>

## Common questions

```chat
user: How accurate are these frequencies vs real objects?
assistant: Mode ratios are based on analytical solutions for idealized shapes (free boundary conditions, uniform material). Real objects have non-uniform thickness, mounting points that constrain vibration, frequency-dependent material damping. But the ratios capture the essential character. A real cube-shaped bell would have mode ratios close to these.

user: Could you compute modes for arbitrary meshes?
assistant: Yes. FEA. Discretize into tetrahedral elements, assemble stiffness and mass matrices, solve the generalized eigenvalue problem `Ku = λMu`. ARPACK computes the first N eigenvalues efficiently. Eigenvectors = mode shapes (how the surface deforms at each frequency). Eigenvalues = frequencies. Standard in acoustic engineering.

user: Why do higher modes decay faster?
assistant: Two reasons. (1) Higher frequencies = shorter wavelengths = higher strain rate = more internal damping per cycle. (2) Higher modes have more surface area in large deformation = more energy radiated as sound per cycle. Both scale with frequency. Decay constant shorter for higher modes.

user: Can this produce realistic bell sounds?
assistant: Close but not quite. Real bells have slight inharmonicity (modes aren't exact integer ratios — creates the characteristic beating) and coupling between modes (energy transfers between them over time, timbre evolves). Add slight frequency jitter and amplitude modulation between modes for significant realism improvement.
```
