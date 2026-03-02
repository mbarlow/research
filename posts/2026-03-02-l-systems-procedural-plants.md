---
title: L-Systems — Procedural Plants from String Rewriting
date: 2026-03-02
order: 22
description: Generate procedural trees and plants using Lindenmayer systems, turtle interpretation, and 3D branching rules with interactive Three.js rendering.
tags: [graphics, l-systems, procedural-generation, generative-art, threejs]
---

## Why L-Systems

In 1968, biologist Aristid Lindenmayer invented a formal grammar to model the growth of algae. The system was simple: start with a string of symbols, apply rewriting rules to each symbol in parallel, repeat. The result was a grammar that could describe branching, recursive growth -- exactly the process that produces trees, ferns, flowers, and vascular networks.

The connection to computer graphics came later, when Przemyslaw Prusinkiewicz realized that if you interpret L-System strings as instructions for a "turtle" (move forward, turn left, turn right, push/pop state), the output is geometry. Suddenly you could generate photorealistic plants from a handful of rules, no artist required. The same framework generates Sierpinski triangles, Koch snowflakes, Hilbert curves, and dozens of other fractal forms.

> [!note]
> L-Systems are parallel rewriting grammars. Every symbol in the string is rewritten simultaneously at each step. This distinguishes them from sequential grammars (like Chomsky grammars) and is what gives them their biological flavor -- every cell in an organism divides at the same time.

## Post Plan (Feature Map)

| Section Goal | Blog Feature Used | Why |
|---|---|---|
| Explain the rewriting mechanism | Code blocks + examples | Make the string expansion tangible |
| Cover turtle interpretation | Code + Mermaid diagram | Bridge from strings to geometry |
| Show 3D extensions | GLSL-like code | Pitch, yaw, roll for volumetric trees |
| Build interactive examples | Three.js scene embed | Multiple L-System presets cycling live |
| Address practical questions | Chat transcript | Handle branching, randomness, context sensitivity |

## String Rewriting

An L-System has three components:

1. **Alphabet**: The set of symbols (F, +, -, [, ], etc.)
2. **Axiom**: The starting string
3. **Rules**: Substitution rules applied in parallel

The classic example -- Algae growth:

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

The string length follows the Fibonacci sequence. This is not a coincidence -- many botanical growth patterns are Fibonacci-structured, and L-Systems naturally produce them.

For graphics, the alphabet gets a geometric interpretation:

| Symbol | Meaning |
|---|---|
| F | Move forward, drawing a line |
| G | Move forward without drawing |
| + | Turn left by angle |
| - | Turn right by angle |
| [ | Push state (save position + direction) |
| ] | Pop state (restore position + direction) |

## The Rewriting Engine

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

A simple tree: axiom `F`, rule `F → FF[+F][-F]`, angle 25°, 4 iterations. Each F segment splits into a trunk extension and two branches. The brackets save and restore the turtle's position, creating the branching structure.

```
Iteration 0: F
Iteration 1: FF[+F][-F]
Iteration 2: FF[+F][-F]FF[+F][-F][+FF[+F][-F]][-FF[+F][-F]]
...
```

The string grows exponentially. 5 iterations of a branching rule can produce strings of 50,000+ characters, generating thousands of line segments. This is fine -- the turtle interpreter is linear in string length.

## Turtle Interpretation

The 2D case is straightforward: maintain position (x, y) and heading angle, advance on F, rotate on +/-:

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

## Extending to 3D

2D trees are flat. Real trees branch in three dimensions. The extension requires a full orientation frame (direction, right, up) instead of a single heading angle, and additional symbols for pitch and roll:

| Symbol | 3D Meaning |
|---|---|
| + / - | Yaw (rotate around up axis) |
| & / ^ | Pitch (rotate around right axis) |
| \ / / | Roll (rotate around direction axis) |

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

With 6 rotation symbols and the push/pop stack, you can describe any branching structure in 3D space.

## Classic Rulesets

These are battle-tested L-System configurations from Prusinkiewicz and Lindenmayer's "The Algorithmic Beauty of Plants":

| Name | Axiom | Rule | Angle | Iterations | Character |
|---|---|---|---|---|---|
| Sympodial Tree | F | F → FF[+F][-F][&F][^F] | 25° | 5 | Bushy deciduous tree |
| Bush | F | F → F[+F]F[-F][F] | 24° | 5 | Dense shrub |
| 3D Fern | F | F → FF&[+F^F][\F^F] | 22° | 5 | Spiral fern fronds |
| Dragon Curve | FX | X → X+YF+, Y → -FX-Y | 90° | 12 | Space-filling fractal |
| Sierpinski | F-G-G | F → F-G+F+G-F, G → GG | 120° | 6 | Triangle fractal |
| Koch Snowflake | F | F → F+F--F+F | 60° | 4 | Classic snowflake edge |

## Interactive Demo

The scene below cycles through three 3D L-System presets: a sympodial tree, a dense bush, and a 3D fern. Each is generated from scratch using string rewriting and turtle interpretation. The camera orbits to show the 3D branching structure.

<div data-scene="l-system-tree.js" style="width:100%;height:420px;"></div>

## Stochastic L-Systems

Deterministic L-Systems produce identical output every time. Adding randomness creates natural variation:

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

Every evaluation produces a different tree, all sharing the same structural DNA. This is how you populate a forest without everything looking cloned.

## Common Questions

```chat
user: How do I control branch thickness?
assistant: Add a width parameter to the turtle state that decreases at each bracket push. When building geometry, use the width to set cylinder radius instead of drawing simple lines. A common formula is width = initialWidth * (ratio ^ depth), where ratio is between 0.6 and 0.8. This matches Leonardo da Vinci's observation that branch cross-section area is conserved at each fork.

user: The string gets enormous. Is there a way to limit it?
assistant: Yes. Most renderers cap at 5-6 iterations for branching rules because the string grows exponentially. You can also prune: after rewriting, walk the string and remove branches below a certain depth threshold before interpretation. Another approach is lazy evaluation -- only expand branches that are visible to the camera.

user: Can L-Systems produce flowers and leaves?
assistant: Yes. Add symbols that are not rewritten but trigger geometry at interpretation time. For example, L could mean "draw a leaf polygon at the current position" and * could mean "draw a flower." Prusinkiewicz's work includes parametric L-Systems where symbols carry numeric arguments (size, age, color) that change with each rewriting step. The combination produces strikingly realistic botanical models.

user: What is the difference between context-free and context-sensitive L-Systems?
assistant: In context-free L-Systems, each symbol is rewritten independently. In context-sensitive L-Systems, the rewriting rule can depend on neighboring symbols. For example, A < B > C → D means "replace B with D only if preceded by A and followed by C." This allows information to propagate along the string, modeling things like hormone signals in plants that cause branching only at certain distances from the root.
```
