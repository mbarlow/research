---
title: L-Systems — Procedural Plants from String Rewriting
date: 2026-03-02
order: 22
description: Generate procedural trees and plants using Lindenmayer systems, turtle interpretation, and 3D branching rules with interactive Three.js rendering.
tags: [graphics, l-systems, procedural-generation, generative-art, threejs]
---

## Why L-systems

1968. Aristid Lindenmayer invents a formal grammar to model algae growth. Start with a string of symbols. Apply rewriting rules to each symbol in parallel. Repeat.

The result describes branching, recursive growth — exactly what produces trees, ferns, flowers, vascular networks.

The graphics connection came later. Prusinkiewicz realized that interpreting L-system strings as turtle instructions (move, turn, push/pop) makes them geometry. Photorealistic plants from a handful of rules. No artist required.

The same framework generates Sierpinski triangles, Koch snowflakes, Hilbert curves, dozens of fractal forms.

> [!note]
> L-systems are *parallel* rewriting grammars. Every symbol rewrites simultaneously at each step. Distinguishes them from sequential grammars (Chomsky). Models the biological flavor — every cell divides at the same time.

## String rewriting

Three components:

1. **Alphabet** — symbols (F, +, -, [, ])
2. **Axiom** — starting string
3. **Rules** — substitutions applied in parallel

Algae:

```
Axiom:  A
Rule:   A → AB
Rule:   B → A

Step 0: A
Step 1: AB
Step 2: ABA
Step 3: ABAAB
Step 4: ABAABABA
```

String length is Fibonacci. Not coincidence — many botanical patterns are Fibonacci-structured.

For graphics, the alphabet gets a geometric interpretation:

| Symbol | Meaning |
|---|---|
| F | Move forward, draw a line |
| G | Move forward, no draw |
| + | Turn left by angle |
| - | Turn right by angle |
| [ | Push state (save position + direction) |
| ] | Pop state (restore) |

## The rewriter

```javascript
function rewrite(axiom, rules, iterations) {
  let current = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const ch of current) {
      next += rules[ch] || ch;  // apply rule or keep symbol
    }
    current = next;
  }
  return current;
}
```

Simple tree: axiom `F`, rule `F → FF[+F][-F]`, angle 25°, 4 iterations. Each F splits into trunk + two branches. Brackets save/restore turtle position → branching structure.

```
Iteration 0: F
Iteration 1: FF[+F][-F]
Iteration 2: FF[+F][-F]FF[+F][-F][+FF[+F][-F]][-FF[+F][-F]]
...
```

Strings grow exponentially. 5 iterations of a branching rule = 50K+ characters, thousands of segments. Fine — turtle interpretation is linear in string length.

## Turtle interpretation

2D: position, heading. Advance on F. Rotate on +/-.

```javascript
function interpret2D(str, angle, step) {
  const segments = [];
  const stack = [];
  let x = 0, y = 0, heading = Math.PI / 2; // start facing up

  for (const ch of str) {
    if (ch === 'F') {
      const nx = x + Math.cos(heading) * step;
      const ny = y + Math.sin(heading) * step;
      segments.push({ x1: x, y1: y, x2: nx, y2: ny });
      x = nx; y = ny;
    } else if (ch === '+') {
      heading += angle;
    } else if (ch === '-') {
      heading -= angle;
    } else if (ch === '[') {
      stack.push({ x, y, heading });
    } else if (ch === ']') {
      const s = stack.pop();
      x = s.x; y = s.y; heading = s.heading;
    }
  }
  return segments;
}
```

## 3D extension

2D trees are flat. Real ones branch in three dimensions. Need a full orientation frame (direction, right, up) and additional rotation symbols.

| Symbol | 3D meaning |
|---|---|
| + / - | Yaw (around up axis) |
| & / ^ | Pitch (around right axis) |
| \ / / | Roll (around direction axis) |

```javascript
// 3D turtle state
let dir = new THREE.Vector3(0, 1, 0);    // growth direction
let right = new THREE.Vector3(1, 0, 0);  // right vector
let up = new THREE.Vector3(0, 0, 1);     // up vector

// Rotation via quaternion
case '&': { // Pitch down
  const q = new Quaternion().setFromAxisAngle(right, angle);
  dir.applyQuaternion(q);
  up.applyQuaternion(q);
  break;
}
```

Six rotation symbols + push/pop stack = any branching structure in 3D.

## Battle-tested rulesets

From Prusinkiewicz and Lindenmayer's *The Algorithmic Beauty of Plants*:

| Name | Axiom | Rule | Angle | Iter | Character |
|---|---|---|---|---|---|
| Sympodial Tree | F | F → FF[+F][-F][&F][^F] | 25° | 5 | Bushy deciduous |
| Bush | F | F → F[+F]F[-F][F] | 24° | 5 | Dense shrub |
| 3D Fern | F | F → FF&[+F^F][\F^F] | 22° | 5 | Spiral fronds |
| Dragon Curve | FX | X → X+YF+, Y → -FX-Y | 90° | 12 | Space-filling |
| Sierpinski | F-G-G | F → F-G+F+G-F, G → GG | 120° | 6 | Triangle fractal |
| Koch Snowflake | F | F → F+F--F+F | 60° | 4 | Classic snowflake |

## Demo

Cycles through three 3D presets: sympodial tree, dense bush, 3D fern. String rewriting + turtle interpretation. Camera orbits.

<div data-scene="l-system-tree.js" style="width:100%;height:420px;"></div>

## Stochastic L-systems

Deterministic = identical output every time. Stochastic = natural variation.

```javascript
// Stochastic rules: multiple replacements with probabilities
const stochasticRules = {
  F: [
    { prob: 0.4, replacement: 'FF[+F][-F]' },
    { prob: 0.3, replacement: 'FF[+F][&F]' },
    { prob: 0.3, replacement: 'F[+F][-F]' },
  ],
};

function stochasticRewrite(axiom, rules, iterations) {
  let current = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const ch of current) {
      const opts = rules[ch];
      if (!opts) { next += ch; continue; }
      const r = Math.random();
      let cumulative = 0;
      for (const opt of opts) {
        cumulative += opt.prob;
        if (r < cumulative) {
          next += opt.replacement;
          break;
        }
      }
    }
    current = next;
  }
  return current;
}
```

Every evaluation produces a different tree. Same structural DNA. How you populate a forest without everything looking cloned.

## Common questions

```chat
user: How do I control branch thickness?
assistant: Add a width parameter to the turtle state. Decrease at each bracket push. Build cylinders, not lines. `width = initial * (ratio ^ depth)`, ratio 0.6–0.8. Matches da Vinci's observation that branch cross-section area is conserved at each fork.

user: The string gets enormous. How do I limit it?
assistant: Cap at 5–6 iterations for branching rules. Or prune: walk the string after rewriting and drop branches below a depth threshold. Or lazy evaluation — only expand branches visible to the camera.

user: Can L-systems produce flowers and leaves?
assistant: Yes. Symbols that aren't rewritten but trigger geometry at interpretation. `L` = draw a leaf polygon. `*` = draw a flower. Prusinkiewicz's parametric L-systems carry numeric args (size, age, color) that change per rewrite. Strikingly realistic botanical models.

user: Context-free vs context-sensitive?
assistant: Context-free — each symbol rewrites independently. Context-sensitive — rules depend on neighbors. `A < B > C → D` means "replace B with D only if preceded by A and followed by C." Lets information propagate along the string. Models hormone signals in plants that cause branching only at certain distances from the root.
```
