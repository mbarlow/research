---
title: Impossible Geometry — Shader Tricks That Lie About Depth
date: 2026-03-04
order: 35
description: Render Penrose triangles, Escher staircases, and impossible objects using fragment shaders that manipulate depth to create geometries that cannot exist in 3D.
tags: [graphics, ray-marching, illusions, glsl, creative-coding, math]
---

## Why impossible geometry

1958. Lionel and Roger Penrose publish "Impossible Objects: A Special Type of Visual Illusion." Penrose triangle. Penrose stairs.

Escher recognizes the potential and creates Waterfall and Ascending and Descending. Structures that look perfectly solid but can't exist in 3D.

The objects exploit a flaw in the visual system. We unconsciously resolve 2D projections into 3D interpretations, and these particular projections admit multiple contradictory 3D interpretations at once.

The rendering trick is delightfully simple. From one specific viewpoint, certain 3D arrangements of disconnected bars appear to form a continuous loop. The bars don't actually connect — there are gaps — but from the right angle, the gaps hide behind the bars themselves. Rotate slightly and the illusion breaks.

With ray marching, build them as proper 3D SDFs. Animate the camera between the impossible viewpoint and a revealing one. The transition between "this can't exist" and "oh, it's just separate bars" is the satisfying part.

> [!note]
> The Penrose triangle has been built as a physical sculpture — but only from one viewing angle does it look like a triangle. The Impossible Triangle roundabout in Perth, Australia is the most famous example.

## The Penrose tribar

Three rectangular bars rotated 120° apart:

```glsl
float penroseTribar(vec3 p) {
  float barW = 0.18;
  float armLen = 1.2;

  // Bar 1: along X
  float bar1 = sdBox(p - vec3(0, -0.6, 0), vec3(armLen, barW, barW));

  // Bar 2: rotated 120 degrees around Z
  vec3 p2 = rotZ(p, 2.094);
  float bar2 = sdBox(p2 - vec3(0, -0.6, 0), vec3(armLen, barW, barW));

  // Bar 3: rotated -120 degrees
  vec3 p3 = rotZ(p, -2.094);
  float bar3 = sdBox(p3 - vec3(0, -0.6, 0), vec3(armLen, barW, barW));

  return min(bar1, min(bar2, bar3));
}
```

From the impossible viewpoint, the three bars visually align to form a closed triangle. Camera at a specific pitch and yaw where the end of each bar lines up with the start of the next. Rotate away → gaps appear.

## The impossible cube

The Necker cube becomes impossible when you swap the depth of two crossing edges:

```glsl
float impossibleCube(vec3 p) {
  float s = 0.6;  // half-size
  float w = 0.06; // bar width
  float d = 1e10;

  // 12 edges of a wireframe cube
  // Front face: 4 edges
  d = min(d, sdBox(p - vec3(0, 0, s), vec3(s, w, w)));
  d = min(d, sdBox(p - vec3(0, 0, s), vec3(w, s, w)));
  // ... etc for all 12 edges

  return d;
}
```

From the right isometric angle, front and back faces overlap so depth is ambiguous. Color front and back edges differently — an edge that's simultaneously in front of and behind another.

## The Möbius ring

Not impossible per se. But it has a property that *feels* impossible: one side. Twist the cross-section by half the polar angle:

```glsl
float moebiusRing(vec3 p) {
  float angle = atan(p.z, p.x);
  float r = length(p.xz) - 1.0;
  vec2 cross = vec2(r, p.y);

  // Twist by half the angle — the key Mobius property
  cross *= rot2(angle * 0.5);

  return sdBox(vec3(cross, 0.0), vec3(0.12, 0.04, 0.04)) - 0.02;
}
```

## Demo

Three impossible objects float in space. Penrose tribar (red/green/blue), impossible wireframe cube (warm white), Möbius ring (purple-gold). Camera oscillates between viewing angles, revealing and hiding the impossibility.

<div data-scene="impossible-geometry.js" style="width:100%;height:420px;"></div>

## Common questions

```chat
user: Can you actually 3D print a Penrose triangle?
assistant: Only as view-dependent sculpture. Perth's Impossible Triangle is real but only works from one angle. From that angle the three separate bars visually align. From any other, you see they're at different depths connected by bent extensions. Several artists have 3D printed similar — ordinary from most angles, snaps into the impossible shape from the magic viewpoint.

user: What other impossible objects exist?
assistant: Dozens. Penrose stairs (ascending forever), blivet (three prongs becoming two), impossible trident, Devil's fork, ambiguous figures like the Necker cube. Oscar Reutersvärd independently discovered the impossible triangle before Penrose and created hundreds of variations. Sandro Del-Prete and Istvan Orosz built elaborate architectural scenes.

user: Could a game use this as a mechanic?
assistant: Several have. Monument Valley (2014) is built entirely around impossible geometry — rotate the camera to create alignments that become walkable paths. Echochrome same principle. Superliminal uses forced perspective. Impossible geometry is a design space for spatial puzzles, not just optical curiosities.

user: Why does the illusion break in stereo vision?
assistant: Each eye sees a slightly different angle. Both can't be at the impossible angle simultaneously. Binocular disparity reveals true depth — one eye sees the gap the other's projection hides. Why these work as 2D images but not in VR. Perth's sculpture works only because you view it from far enough that inter-ocular parallax is negligible.
```
