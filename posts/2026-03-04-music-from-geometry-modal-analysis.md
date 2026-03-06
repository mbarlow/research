---
title: Music From Geometry — Modal Analysis and Shape Acoustics
date: 2026-03-04
order: 29
description: Synthesize sound from 3D shapes by computing their resonant frequencies, turning geometry into musical instruments using modal analysis.
tags: [audio, physics, simulation, web-audio, threejs, math]
---

## Why Modal Analysis

In 1966, mathematician Mark Kac asked "Can one hear the shape of a drum?" — whether the resonant frequencies of a vibrating membrane uniquely determine its geometry. The answer turned out to be no (counterexamples were found in 1992), but the question revealed something profound: geometry and sound are deeply linked. Every rigid body has a set of resonant frequencies — modes — determined by its shape, material, and boundary conditions. Strike a bell and you hear its geometry.

Modal analysis is the study of these resonant modes. A cube rings differently than a sphere. A thin plate produces different harmonics than a thick bar. The relationships between modal frequencies determine whether something sounds "musical" (harmonic ratios) or "noisy" (inharmonic ratios). This is why a tuning fork sounds pure, a bell sounds rich, and a cymbal sounds chaotic — their geometries produce different distributions of resonant frequencies.

The Web Audio API gives us everything needed to synthesize modal sounds in the browser: oscillators at arbitrary frequencies, gain envelopes for decay, and real-time mixing. Combined with Three.js for visualization, we can build instruments that you play by clicking on shapes.

> [!note]
> The eigenvalue equation for a vibrating membrane is ∇^2 phi = -lambda * phi (the Helmholtz equation). The eigenvalues lambda determine the resonant frequencies. For simple shapes (rectangles, circles), closed-form solutions exist. For arbitrary geometry, finite element methods compute approximate modes.

## Post Plan (Feature Map)

| Section Goal | Blog Feature Used | Why |
|---|---|---|
| Explain modal analysis | Text + math | The physics of why shapes have sound |
| Show harmonic vs. inharmonic | Table | Why drums vs. bars sound different |
| Cover Web Audio synthesis | Code blocks | Building modal sounds from sine waves |
| Interactive demo | Three.js scene embed | Click shapes to hear their geometry |
| Address questions | Chat transcript | Material properties, complexity, realism |

## Harmonic Series by Shape

Different geometries produce different relationships between their resonant frequencies:

| Shape | Mode Ratios | Sound Character | Example |
|---|---|---|---|
| String (1D) | 1, 2, 3, 4, 5... | Perfectly harmonic | Guitar string |
| Bar (1D, free) | 1, 2.76, 5.40, 8.93... | Inharmonic, bright | Xylophone |
| Circular membrane | 1, 1.59, 2.14, 2.30... | Inharmonic, complex | Drum head |
| Square plate | 1, 1.58, 2.0, 2.24... | Metallic, bell-like | Gong |
| Sphere (shell) | 1, 1.47, 2.09, 2.56... | Singing, bright | Singing bowl |

The key insight: harmonic ratios (integer multiples) sound "musical" because our auditory system fuses them into a single pitch. Inharmonic ratios sound "metallic" or "noisy" because the brain can't resolve them into a single fundamental.

## Synthesizing Modal Sound

Each mode is a damped sine wave. Higher modes typically decay faster (they lose energy more quickly). Sum them together:

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

For realism, add a short noise burst at the onset — the "attack transient" that contains the broadband energy of the initial impact:

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

## Material Properties

The same geometry sounds different depending on material. Material affects two things:

1. **Frequency scaling**: stiffer materials → higher frequencies (Young's modulus)
2. **Decay rates**: denser materials ring longer, softer materials damp faster

```javascript
const MATERIALS = {
  steel:  { freqScale: 1.0, decayScale: 1.0 },
  glass:  { freqScale: 1.2, decayScale: 0.7 },
  wood:   { freqScale: 0.6, decayScale: 0.3 },
  rubber: { freqScale: 0.3, decayScale: 0.1 },
};
```

## Interactive Demo

Click any shape to strike it and hear its modal frequencies. Each shape has a distinct harmonic signature — the cube sounds metallic, the sphere sings like a bowl, the cylinder rings like a tubular bell, and the cone thuds like a muted gong. Shapes pulse and glow when struck.

<div data-scene="modal-sound.js" style="width:100%;height:420px;"></div>

## Common Questions

```chat
user: How accurate are these frequencies compared to real objects?
assistant: The mode ratios are based on analytical solutions for idealized shapes (free boundary conditions, uniform material). Real objects have additional complexity — non-uniform thickness, mounting points that constrain vibration, and material damping that varies with frequency. But the ratios capture the essential character. A real cube-shaped bell would have mode ratios close to what's shown here.

user: Could you compute modes for arbitrary meshes?
assistant: Yes, using finite element analysis (FEA). Discretize the mesh into tetrahedral elements, assemble the stiffness and mass matrices, and solve the generalized eigenvalue problem Ku = lambda * Mu. Libraries like ARPACK compute the first N eigenvalues efficiently. The resulting eigenvectors are the mode shapes (how the surface deforms at each frequency), and the eigenvalues give the frequencies. This is standard in acoustic engineering.

user: Why do higher modes decay faster?
assistant: Two reasons. First, higher-frequency vibrations have shorter wavelengths, so the strain rate is higher and internal material damping dissipates more energy per cycle. Second, higher modes have more surface area undergoing large deformations, which means more energy radiated as sound per cycle. Both effects scale roughly with frequency, which is why the exponential decay constant is shorter for higher modes.

user: Can this produce realistic bell sounds?
assistant: Close but not quite. Real bells have two additional features: slight inharmonicity (modes aren't exact integer ratios, which creates the characteristic "beating" of bells), and coupling between modes (energy transfers between modes over time, causing the timbre to evolve). Adding slight frequency jitter and amplitude modulation between modes would significantly improve realism.
```
