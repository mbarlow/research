---
title: Impossible Geometry — Shader Tricks That Lie About Depth
date: 2026-03-04
order: 35
description: Render Penrose triangles, Escher staircases, and impossible objects using fragment shaders that manipulate depth to create geometries that cannot exist in 3D.
tags: [graphics, ray-marching, illusions, glsl, creative-coding, math]
---

## Why Impossible Geometry

In 1958, Lionel and Roger Penrose published "Impossible Objects: A Special Type of Visual Illusion," introducing the Penrose triangle and Penrose stairs. M.C. Escher immediately recognized the potential and created Waterfall and Ascending and Descending — images of structures that look perfectly solid but cannot exist in three dimensions. The objects exploit a flaw in our visual system: we unconsciously resolve 2D projections into 3D interpretations, and these particular projections admit multiple contradictory 3D interpretations simultaneously.

The rendering trick is delightfully simple: from one specific viewpoint, certain 3D arrangements of disconnected bars appear to form a continuous loop. The bars don't actually connect — there are gaps between them — but from the right angle, the gaps are hidden behind the bars themselves. Rotate the camera even slightly and the illusion breaks: you see that the bars are at different depths and don't meet.

With ray marching, we can build these objects as proper 3D SDFs and animate the camera between the "impossible" viewpoint and a revealing viewpoint. The transition between "this can't exist" and "oh, it's just separate bars" is the most satisfying part.

> [!note]
> The Penrose triangle has been built as a physical sculpture — but only from one specific viewing angle does it appear to be a triangle. From any other angle, you see that the three bars are at different depths, connected by carefully shaped extensions that hide the gaps. The sculpture at the Impossible Triangle roundabout in Perth, Australia is the most famous example.

## Post Plan (Feature Map)

| Section Goal | Blog Feature Used | Why |
|---|---|---|
| Explain impossible objects | Text | Penrose triangle, Escher's work |
| Cover the visual system exploit | Text + callout | Why our brains are fooled |
| Show ray marching implementation | Code blocks | SDFs for impossible objects |
| The "impossible angle" trick | Code blocks | Camera positioning |
| Interactive demo | Three.js scene embed | Watch illusions form and break |
| Address questions | Chat transcript | Physical sculptures, more illusions |

## The Penrose Tribar in SDFs

The tribar is three rectangular bars rotated 120 degrees apart:

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

From the impossible viewpoint, the three bars visually align to form a closed triangle. The camera is positioned at a specific pitch and yaw where the end of each bar lines up with the beginning of the next. Rotate away from this angle and the gaps appear.

## The Impossible Cube

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

From the right isometric angle, the front and back faces overlap in a way that makes the depth ambiguous. Color the front and back edges differently and the impossibility becomes vivid — an edge that's simultaneously in front of and behind another.

## The Mobius Ring

A Mobius strip is not impossible per se, but it has a property that feels impossible: it has only one side. Ray marching a Mobius strip by twisting the cross-section by half the polar angle:

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

## Interactive Demo

Three impossible objects float in space: a Penrose tribar (left, red/green/blue), an impossible wireframe cube (center, warm white), and a Mobius ring (right, purple-gold). The camera slowly oscillates between viewing angles, revealing and hiding the impossibility. Watch the tribar — at the "impossible" angle, it looks like a solid triangle; as it rotates, the gaps between the bars become visible.

<div data-scene="impossible-geometry.js" style="width:100%;height:420px;"></div>

## Common Questions

```chat
user: Can you actually 3D print a Penrose triangle?
assistant: Only as a view-dependent sculpture. The Perth Impossible Triangle is a real physical structure, but it only works from one viewing angle. From that angle, the three separate bars visually align. From any other angle, you see they're at different depths connected by bent extensions. Several artists have 3D printed similar sculptures — they look ordinary from most angles but suddenly snap into the impossible shape from the magic viewpoint.

user: What other impossible objects exist?
assistant: Dozens. The Penrose stairs (ascending forever), the blivet (three prongs becoming two), the impossible trident, Devil's fork, and many ambiguous figures like the Necker cube. Oscar Reutersward independently discovered the impossible triangle before Penrose and created hundreds of variations. Sandro Del-Prete and Istvan Orosz have created elaborate impossible architectural scenes. The field is surprisingly rich.

user: Could a game use impossible geometry as a mechanic?
assistant: Several have. Monument Valley (2014) is built entirely around impossible geometry — the player rotates the camera to create visual alignments that become walkable paths. Echochrome uses the same principle. Superliminal uses forced perspective (objects change size based on where you "place" them visually). These games prove that impossible geometry isn't just an optical curiosity — it's a design space for spatial puzzles.

user: Why does the illusion break with stereo vision?
assistant: Each eye sees a slightly different angle, and the two viewpoints can't both be at the "impossible" angle simultaneously. Binocular disparity reveals the true depth — one eye sees the gap that the other eye's projection hides. This is why impossible objects work as 2D images but not in VR. The Penrose triangle sculpture in Perth only works because you view it from far enough away that the parallax between your eyes is negligible.
```
