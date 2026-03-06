---
title: Audio Spectrogram Terrain — Fly Through Sound
date: 2026-03-04
order: 34
description: Transform audio spectrograms into 3D terrain and fly through the landscape of sound, where frequency is width, time is depth, and amplitude is height.
tags: [audio, visualization, web-audio, threejs, terrain, creative-coding]
---

## Why Spectrogram Terrain

A spectrogram is a 2D image: time on one axis, frequency on the other, brightness showing amplitude. It's the standard way to visualize audio — every audio editor, every speech recognition paper, every birdsong field guide uses spectrograms. But a spectrogram is also a heightmap. Map amplitude to elevation and the spectrogram becomes a 3D terrain you can fly through.

The mapping is natural: bass frequencies form broad, rolling hills. Treble frequencies create sharp, jagged ridges. Percussive hits appear as cliff walls spanning all frequencies. Harmonic content — voices, instruments — creates parallel ridges at harmonic intervals, like mountain ranges. The resulting terrain is a physical landscape of sound, where the topography tells you about the audio's structure at a glance.

The Web Audio API's AnalyserNode provides real-time FFT data at 60fps. Feed it into a Three.js displacement map and you have a scrolling terrain that builds itself in real time from audio. No pre-processing, no offline rendering. The sound becomes landscape as you watch.

> [!note]
> The Short-Time Fourier Transform (STFT) that generates spectrograms is a windowed DFT — it divides audio into overlapping frames and computes the frequency content of each. The window size controls the time-frequency tradeoff: longer windows give better frequency resolution but smear transients. The Web Audio AnalyserNode uses a default FFT size of 2048 samples (~46ms at 44.1kHz), which is a good balance for visualization.

## Post Plan (Feature Map)

| Section Goal | Blog Feature Used | Why |
|---|---|---|
| Explain spectrograms | Text | Time-frequency representation basics |
| Show the mapping | Code blocks + math | Frequency → X, Time → Z, Amplitude → Y |
| Cover the scrolling buffer | Code blocks | Real-time terrain update |
| Color mapping | Code blocks | Amplitude to color ramp |
| Interactive demo | Three.js scene embed | Fly through a procedural spectrogram |
| Address questions | Chat transcript | Real audio, performance, VR |

## The Mapping

```
Spectrogram → Terrain:
  Frequency bin index → X position (width)
  Time slice index   → Z position (depth)
  FFT magnitude      → Y position (height)
  FFT magnitude      → Vertex color (dark = quiet, bright = loud)
```

## Scrolling Buffer

Each frame, capture one FFT column and shift the terrain forward:

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

## Color Ramp

Map FFT amplitude to vertex color for visual depth:

```javascript
function heightColor(val) {
  // Dark purple valleys → teal mid-heights → yellow-white peaks
  const r = Math.min(val * 2.0, 1.0) * 0.3 + val * val * 0.7;
  const g = Math.max(0, val - 0.2) * 1.2 * 0.7;
  const b = 0.15 + val * 0.5;
  return [r, g, b];
}
```

## Procedural Spectrogram

For the demo, instead of requiring audio input, we generate a synthetic spectrogram that looks like real audio. Multiple Gaussian peaks drift in frequency over time, simulating harmonic content, with periodic broadband bursts simulating percussive events:

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

## Interactive Demo

A procedural spectrogram scrolls in real time, creating an evolving 3D landscape. Harmonic peaks form parallel ridges, percussive events create cliff walls, and the camera flies through the terrain at a low angle. The color encodes amplitude — dark valleys are silence, bright peaks are the loudest frequencies.

<div data-scene="spectrogram-terrain.js" style="width:100%;height:420px;"></div>

## Common Questions

```chat
user: Can this work with real audio from a microphone?
assistant: Yes. Replace the procedural generator with Web Audio AnalyserNode connected to getUserMedia(). Call analyser.getByteFrequencyData() each frame to get the FFT column. The only change is the data source — the terrain update code is identical. Browser autoplay policy requires a user gesture before starting audio capture, so you'd add a "Start" button.

user: How do you handle the time-frequency tradeoff?
assistant: The FFT size controls it. Larger FFT (4096) gives more frequency bins and better frequency resolution, but each column represents ~93ms of audio, smearing fast transients. Smaller FFT (512) gives ~12ms time resolution but only 256 frequency bins. For terrain visualization, 1024-2048 is the sweet spot — enough frequency detail to see harmonics, enough time detail to see rhythm.

user: Would this work in VR?
assistant: Beautifully. The terrain metaphor works even better in VR because you have depth perception and scale. Stand on a bass frequency ridge and look across at the treble peaks. Walk through time as the audio plays. The mapping from audio to 3D space is intuitive enough that you can "read" the audio from the landscape — identify instruments by their ridge patterns, find the beat from the cliff walls, spot the chorus by the change in terrain complexity.

user: What about a log frequency scale?
assistant: Critical for musical content. Human pitch perception is logarithmic — each octave doubles in frequency. A linear frequency axis wastes most of its bins on high frequencies we don't care about, while cramming all the musically important bass and midrange into a few pixels. A mel scale or log scale spaces the bins perceptually, giving equal visual weight to each octave. The terrain looks more musical and the harmonic ridges are evenly spaced.
```
