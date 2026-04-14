---
title: Audio Spectrogram Terrain — Fly Through Sound
date: 2026-03-04
order: 34
description: Transform audio spectrograms into 3D terrain and fly through the landscape of sound, where frequency is width, time is depth, and amplitude is height.
tags: [audio, visualization, web-audio, threejs, terrain, creative-coding]
---

## Spectrograms are heightmaps

A spectrogram is a 2D image. Time on one axis, frequency on the other, brightness as amplitude. Standard audio visualization.

It's also a heightmap.

Map amplitude to elevation. The spectrogram becomes a terrain you fly through.

The mapping is natural: bass = broad rolling hills. Treble = sharp jagged ridges. Percussive hits = cliff walls spanning all frequencies. Harmonic content = parallel ridges at harmonic intervals — mountain ranges of voice and instrument.

The Web Audio AnalyserNode provides real-time FFT at 60fps. Feed it into a Three.js displacement map → scrolling terrain that builds itself as the audio plays. No pre-processing. No offline rendering. Sound becomes landscape.

> [!note]
> The Short-Time Fourier Transform (STFT) is a windowed DFT — overlapping frames, frequency content per frame. Window size = time-frequency tradeoff. Longer = better frequency resolution but smears transients. Web Audio default 2048 samples (~46ms at 44.1kHz) is a good visualization balance.

## The mapping

```
Spectrogram → Terrain:
  Frequency bin index → X position (width)
  Time slice index   → Z position (depth)
  FFT magnitude      → Y position (height)
  FFT magnitude      → Vertex color (dark = quiet, bright = loud)
```

## Scrolling buffer

Capture one FFT column per frame. Shift the terrain forward.

```javascript
const FREQ_BINS = 96;
const TIME_SLICES = 120;
const specBuffer = Array(TIME_SLICES).fill(null)
  .map(() => new Float32Array(FREQ_BINS));

function updateTerrain(newColumn) {
  // Shift all rows back
  for (let t = TIME_SLICES - 1; t > 0; t--) {
    specBuffer[t].set(specBuffer[t - 1]);
  }
  // Insert new column at front
  specBuffer[0] = newColumn;

  // Update mesh vertex positions
  for (let t = 0; t < TIME_SLICES; t++) {
    for (let f = 0; f < FREQ_BINS; f++) {
      const vi = t * FREQ_BINS + f;
      geometry.attributes.position.setY(vi, specBuffer[t][f] * heightScale);
    }
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
}
```

## Color ramp

Amplitude → vertex color for visual depth.

```javascript
function heightColor(val) {
  // Dark purple valleys → teal mid-heights → yellow-white peaks
  const r = Math.min(val * 2.0, 1.0) * 0.3 + val * val * 0.7;
  const g = Math.max(0, val - 0.2) * 1.2 * 0.7;
  const b = 0.15 + val * 0.5;
  return [r, g, b];
}
```

## Procedural spectrogram

For the demo, no audio input. Generate something that looks like real audio. Multiple Gaussian peaks drift in frequency over time (harmonic content), with periodic broadband bursts (percussion).

```javascript
function generateColumn(time) {
  const data = new Float32Array(FREQ_BINS);
  const peaks = [
    { freq: 0.08, amp: 1.0, drift: 0.3, speed: 0.7 },
    { freq: 0.16, amp: 0.7, drift: 0.15, speed: 1.1 },
    { freq: 0.24, amp: 0.5, drift: 0.2, speed: 0.5 },
    // ... harmonic series that moves
  ];
  for (let i = 0; i < FREQ_BINS; i++) {
    const f = i / FREQ_BINS;
    for (const p of peaks) {
      const center = p.freq + Math.sin(time * p.speed) * p.drift;
      data[i] += p.amp * Math.exp(-((f - center) ** 2) / 0.0005);
    }
  }
  return data;
}
```

## Demo

Procedural spectrogram scrolling in real time. Harmonic peaks → parallel ridges. Percussive events → cliff walls. Camera flies through at a low angle. Color = amplitude.

<div data-scene="spectrogram-terrain.js" style="width:100%;height:420px;"></div>

## Common questions

```chat
user: Can this work with real mic audio?
assistant: Yes. Swap the procedural generator for Web Audio AnalyserNode + getUserMedia. Call `analyser.getByteFrequencyData()` per frame. Terrain update code is identical. Browser autoplay policy needs a user gesture — add a Start button.

user: How do you handle the time-frequency tradeoff?
assistant: FFT size. Larger (4096) = more bins, better frequency resolution, but ~93ms per column → smears transients. Smaller (512) = 12ms time resolution, only 256 bins. For terrain, 1024–2048 is the sweet spot — enough frequency detail for harmonics, enough time detail for rhythm.

user: Would this work in VR?
assistant: Beautifully. Depth perception and scale make the terrain metaphor stronger. Stand on a bass ridge, look across at treble peaks. Walk through time as audio plays. Identify instruments by ridge pattern. Find the beat from cliff walls. Spot the chorus from the change in complexity.

user: What about log frequency scale?
assistant: Critical for music. Pitch perception is logarithmic — each octave doubles. Linear axis wastes most bins on high frequencies that don't matter musically and crams the bass/midrange into a few pixels. Mel or log scale spaces bins perceptually. Equal visual weight per octave. Terrain looks more musical, harmonic ridges are evenly spaced.
```
