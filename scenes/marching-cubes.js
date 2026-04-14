// Marching Cubes isosurface extraction with animated metaballs
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

// ─── Classic Marching Cubes Edge Table (256 entries) ────────────────────────
// Each entry is a 12-bit mask indicating which edges are intersected.
const EDGE_TABLE = [
  0x0,0x109,0x203,0x30a,0x406,0x50f,0x605,0x70c,0x80c,0x905,0x0a0f,0x0b06,0x0c0a,0x0d03,0x0e09,0x0f00,
  0x190,0x099,0x393,0x29a,0x596,0x49f,0x795,0x69c,0x99c,0x895,0x0b9f,0x0a96,0x0d9a,0x0c93,0x0f99,0x0e90,
  0x230,0x339,0x033,0x13a,0x636,0x73f,0x435,0x53c,0x0a3c,0x0b35,0x083f,0x0936,0x0e3a,0x0f33,0x0c39,0x0d30,
  0x3a0,0x2a9,0x1a3,0x0aa,0x7a6,0x6af,0x5a5,0x4ac,0x0bac,0x0aa5,0x09af,0x08a6,0x0faa,0x0ea3,0x0da9,0x0ca0,
  0x460,0x569,0x663,0x76a,0x066,0x16f,0x265,0x36c,0x0c6c,0x0d65,0x0e6f,0x0f66,0x086a,0x0963,0x0a69,0x0b60,
  0x5f0,0x4f9,0x7f3,0x6fa,0x1f6,0x0ff,0x3f5,0x2fc,0x0dfc,0x0cf5,0x0fff,0x0ef6,0x09fa,0x08f3,0x0bf9,0x0af0,
  0x650,0x759,0x453,0x55a,0x256,0x35f,0x055,0x15c,0x0e5c,0x0f55,0x0c5f,0x0d56,0x0a5a,0x0b53,0x0859,0x0950,
  0x7c0,0x6c9,0x5c3,0x4ca,0x3c6,0x2cf,0x1c5,0x0cc,0x0fcc,0x0ec5,0x0dcf,0x0cc6,0x0bca,0x0ac3,0x09c9,0x08c0,
  0x8c0,0x9c9,0x0ac3,0x0bca,0x0cc6,0x0dcf,0x0ec5,0x0fcc,0x0cc,0x1c5,0x2cf,0x3c6,0x4ca,0x5c3,0x6c9,0x7c0,
  0x950,0x859,0x0b53,0x0a5a,0x0d56,0x0c5f,0x0f55,0x0e5c,0x15c,0x055,0x35f,0x256,0x55a,0x453,0x759,0x650,
  0x0af0,0x0bf9,0x08f3,0x09fa,0x0ef6,0x0fff,0x0cf5,0x0dfc,0x2fc,0x3f5,0x0ff,0x1f6,0x6fa,0x7f3,0x4f9,0x5f0,
  0x0b60,0x0a69,0x0963,0x086a,0x0f66,0x0e6f,0x0d65,0x0c6c,0x36c,0x265,0x16f,0x066,0x76a,0x663,0x569,0x460,
  0x0ca0,0x0da9,0x0ea3,0x0faa,0x08a6,0x09af,0x0aa5,0x0bac,0x4ac,0x5a5,0x6af,0x7a6,0x0aa,0x1a3,0x2a9,0x3a0,
  0x0d30,0x0c39,0x0f33,0x0e3a,0x0936,0x083f,0x0b35,0x0a3c,0x53c,0x435,0x73f,0x636,0x13a,0x033,0x339,0x230,
  0x0e90,0x0f99,0x0c93,0x0d9a,0x0a96,0x0b9f,0x0895,0x099c,0x69c,0x795,0x49f,0x596,0x29a,0x393,0x099,0x190,
  0x0f00,0x0e09,0x0d03,0x0c0a,0x0b06,0x0a0f,0x0905,0x080c,0x70c,0x605,0x50f,0x406,0x30a,0x203,0x109,0x0
];

// ─── Triangle Table ─────────────────────────────────────────────────────────
// Each entry lists edge indices for up to 5 triangles (-1 terminates).
const TRI_TABLE = [
  [-1],
  [0,8,3,-1],
  [0,1,9,-1],
  [1,8,3,9,8,1,-1],
  [1,2,10,-1],
  [0,8,3,1,2,10,-1],
  [9,2,10,0,2,9,-1],
  [2,8,3,2,10,8,10,9,8,-1],
  [3,11,2,-1],
  [0,11,2,8,11,0,-1],
  [1,9,0,2,3,11,-1],
  [1,11,2,1,9,11,9,8,11,-1],
  [3,10,1,11,10,3,-1],
  [0,10,1,0,8,10,8,11,10,-1],
  [3,9,0,3,11,9,11,10,9,-1],
  [9,8,10,10,8,11,-1],
  [4,7,8,-1],
  [4,3,0,7,3,4,-1],
  [0,1,9,8,4,7,-1],
  [4,1,9,4,7,1,7,3,1,-1],
  [1,2,10,8,4,7,-1],
  [3,4,7,3,0,4,1,2,10,-1],
  [9,2,10,9,0,2,8,4,7,-1],
  [2,10,9,2,9,7,2,7,3,7,9,4,-1],
  [8,4,7,3,11,2,-1],
  [11,4,7,11,2,4,2,0,4,-1],
  [9,0,1,8,4,7,2,3,11,-1],
  [4,7,11,9,4,11,9,11,2,9,2,1,-1],
  [3,10,1,3,11,10,7,8,4,-1],
  [1,11,10,1,4,11,1,0,4,7,11,4,-1],
  [4,7,8,9,0,11,9,11,10,11,0,3,-1],
  [4,7,11,4,11,9,9,11,10,-1],
  [9,5,4,-1],
  [9,5,4,0,8,3,-1],
  [0,5,4,1,5,0,-1],
  [8,5,4,8,3,5,3,1,5,-1],
  [1,2,10,9,5,4,-1],
  [3,0,8,1,2,10,4,9,5,-1],
  [5,2,10,5,4,2,4,0,2,-1],
  [2,10,5,3,2,5,3,5,4,3,4,8,-1],
  [9,5,4,2,3,11,-1],
  [0,11,2,0,8,11,4,9,5,-1],
  [0,5,4,0,1,5,2,3,11,-1],
  [2,1,5,2,5,8,2,8,11,4,8,5,-1],
  [10,3,11,10,1,3,9,5,4,-1],
  [4,9,5,0,8,1,8,10,1,8,11,10,-1],
  [5,4,0,5,0,11,5,11,10,11,0,3,-1],
  [5,4,8,5,8,10,10,8,11,-1],
  [9,7,8,5,7,9,-1],
  [9,3,0,9,5,3,5,7,3,-1],
  [0,7,8,0,1,7,1,5,7,-1],
  [1,5,3,3,5,7,-1],
  [9,7,8,9,5,7,10,1,2,-1],
  [10,1,2,9,5,0,5,3,0,5,7,3,-1],
  [8,0,2,8,2,5,8,5,7,10,5,2,-1],
  [2,10,5,2,5,3,3,5,7,-1],
  [7,9,5,7,8,9,3,11,2,-1],
  [9,5,7,9,7,2,9,2,0,2,7,11,-1],
  [2,3,11,0,1,8,1,7,8,1,5,7,-1],
  [11,2,1,11,1,7,7,1,5,-1],
  [9,5,8,8,5,7,10,1,3,10,3,11,-1],
  [5,7,0,5,0,9,7,11,0,1,0,10,11,10,0,-1],
  [11,10,0,11,0,3,10,5,0,8,0,7,5,7,0,-1],
  [11,10,5,7,11,5,-1],
  [10,6,5,-1],
  [0,8,3,5,10,6,-1],
  [9,0,1,5,10,6,-1],
  [1,8,3,1,9,8,5,10,6,-1],
  [1,6,5,2,6,1,-1],
  [1,6,5,1,2,6,3,0,8,-1],
  [9,6,5,9,0,6,0,2,6,-1],
  [5,9,8,5,8,2,5,2,6,3,2,8,-1],
  [2,3,11,10,6,5,-1],
  [11,0,8,11,2,0,10,6,5,-1],
  [0,1,9,2,3,11,5,10,6,-1],
  [5,10,6,1,9,2,9,11,2,9,8,11,-1],
  [6,3,11,6,5,3,5,1,3,-1],
  [0,8,11,0,11,5,0,5,1,5,11,6,-1],
  [3,11,6,0,3,6,0,6,5,0,5,9,-1],
  [6,5,9,6,9,11,11,9,8,-1],
  [5,10,6,4,7,8,-1],
  [4,3,0,4,7,3,6,5,10,-1],
  [1,9,0,5,10,6,8,4,7,-1],
  [10,6,5,1,9,7,1,7,3,7,9,4,-1],
  [6,1,2,6,5,1,4,7,8,-1],
  [1,2,5,5,2,6,3,0,4,3,4,7,-1],
  [8,4,7,9,0,5,0,6,5,0,2,6,-1],
  [7,3,9,7,9,4,3,2,9,5,9,6,2,6,9,-1],
  [3,11,2,7,8,4,10,6,5,-1],
  [5,10,6,4,7,2,4,2,0,2,7,11,-1],
  [0,1,9,4,7,8,2,3,11,5,10,6,-1],
  [9,2,1,9,11,2,9,4,11,7,11,4,5,10,6,-1],
  [8,4,7,3,11,5,3,5,1,5,11,6,-1],
  [5,1,11,5,11,6,1,0,11,7,11,4,0,4,11,-1],
  [0,5,9,0,6,5,0,3,6,11,6,3,8,4,7,-1],
  [6,5,9,6,9,11,4,7,9,7,11,9,-1],
  [10,4,9,6,4,10,-1],
  [4,10,6,4,9,10,0,8,3,-1],
  [10,0,1,10,6,0,6,4,0,-1],
  [8,3,1,8,1,6,8,6,4,6,1,10,-1],
  [1,4,9,1,2,4,2,6,4,-1],
  [3,0,8,1,2,9,2,4,9,2,6,4,-1],
  [0,2,4,4,2,6,-1],
  [8,3,2,8,2,4,4,2,6,-1],
  [10,4,9,10,6,4,11,2,3,-1],
  [0,8,2,2,8,11,4,9,10,4,10,6,-1],
  [3,11,2,0,1,6,0,6,4,6,1,10,-1],
  [6,4,1,6,1,10,4,8,1,2,1,11,8,11,1,-1],
  [9,6,4,9,3,6,9,1,3,11,6,3,-1],
  [8,11,1,8,1,0,11,6,1,9,1,4,6,4,1,-1],
  [3,11,6,3,6,0,0,6,4,-1],
  [6,4,8,11,6,8,-1],
  [7,10,6,7,8,10,8,9,10,-1],
  [0,7,3,0,10,7,0,9,10,6,7,10,-1],
  [10,6,7,1,10,7,1,7,8,1,8,0,-1],
  [10,6,7,10,7,1,1,7,3,-1],
  [1,2,6,1,6,8,1,8,9,8,6,7,-1],
  [2,6,9,2,9,1,6,7,9,0,9,3,7,3,9,-1],
  [7,8,0,7,0,6,6,0,2,-1],
  [7,3,2,6,7,2,-1],
  [2,3,11,10,6,8,10,8,9,8,6,7,-1],
  [2,0,7,2,7,11,0,9,7,6,7,10,9,10,7,-1],
  [1,8,0,1,7,8,1,10,7,6,7,10,2,3,11,-1],
  [11,2,1,11,1,7,10,6,1,6,7,1,-1],
  [8,9,6,8,6,7,9,1,6,11,6,3,1,3,6,-1],
  [0,9,1,11,6,7,-1],
  [7,8,0,7,0,6,3,11,0,11,6,0,-1],
  [7,11,6,-1],
  [7,6,11,-1],
  [3,0,8,11,7,6,-1],
  [0,1,9,11,7,6,-1],
  [8,1,9,8,3,1,11,7,6,-1],
  [10,1,2,6,11,7,-1],
  [1,2,10,3,0,8,6,11,7,-1],
  [2,9,0,2,10,9,6,11,7,-1],
  [6,11,7,2,10,3,10,8,3,10,9,8,-1],
  [7,2,3,6,2,7,-1],
  [7,0,8,7,6,0,6,2,0,-1],
  [2,7,6,2,3,7,0,1,9,-1],
  [1,6,2,1,8,6,1,9,8,8,7,6,-1],
  [10,7,6,10,1,7,1,3,7,-1],
  [10,7,6,1,7,10,1,8,7,1,0,8,-1],
  [0,3,7,0,7,10,0,10,9,6,10,7,-1],
  [7,6,10,7,10,8,8,10,9,-1],
  [6,8,4,11,8,6,-1],
  [3,6,11,3,0,6,0,4,6,-1],
  [8,6,11,8,4,6,9,0,1,-1],
  [9,4,6,9,6,3,9,3,1,11,3,6,-1],
  [6,8,4,6,11,8,2,10,1,-1],
  [1,2,10,3,0,11,0,6,11,0,4,6,-1],
  [4,11,8,4,6,11,0,2,9,2,10,9,-1],
  [10,9,3,10,3,2,9,4,3,11,3,6,4,6,3,-1],
  [8,2,3,8,4,2,4,6,2,-1],
  [0,4,2,4,6,2,-1],
  [1,9,0,2,3,4,2,4,6,4,3,8,-1],
  [1,9,4,1,4,2,2,4,6,-1],
  [8,1,3,8,6,1,8,4,6,6,10,1,-1],
  [10,1,0,10,0,6,6,0,4,-1],
  [4,6,3,4,3,8,6,10,3,0,3,9,10,9,3,-1],
  [10,9,4,6,10,4,-1],
  [4,9,5,7,6,11,-1],
  [0,8,3,4,9,5,11,7,6,-1],
  [5,0,1,5,4,0,7,6,11,-1],
  [11,7,6,8,3,4,3,5,4,3,1,5,-1],
  [9,5,4,10,1,2,7,6,11,-1],
  [6,11,7,1,2,10,0,8,3,4,9,5,-1],
  [7,6,11,5,4,10,4,2,10,4,0,2,-1],
  [3,4,8,3,5,4,3,2,5,10,5,2,11,7,6,-1],
  [7,2,3,7,6,2,5,4,9,-1],
  [9,5,4,0,8,6,0,6,2,6,8,7,-1],
  [3,6,2,3,7,6,1,5,0,5,4,0,-1],
  [6,2,8,6,8,7,2,1,8,4,8,5,1,5,8,-1],
  [9,5,4,10,1,6,1,7,6,1,3,7,-1],
  [1,6,10,1,7,6,1,0,7,8,7,0,9,5,4,-1],
  [4,0,10,4,10,5,0,3,10,6,10,7,3,7,10,-1],
  [7,6,10,7,10,8,5,4,10,4,8,10,-1],
  [6,9,5,6,11,9,11,8,9,-1],
  [3,6,11,0,6,3,0,5,6,0,9,5,-1],
  [0,11,8,0,5,11,0,1,5,5,6,11,-1],
  [6,11,3,6,3,5,5,3,1,-1],
  [1,2,10,9,5,11,9,11,8,11,5,6,-1],
  [0,11,3,0,6,11,0,9,6,5,6,9,1,2,10,-1],
  [11,8,5,11,5,6,8,0,5,10,5,2,0,2,5,-1],
  [6,11,3,6,3,5,2,10,3,10,5,3,-1],
  [5,8,9,5,2,8,5,6,2,3,8,2,-1],
  [9,5,6,9,6,0,0,6,2,-1],
  [1,5,8,1,8,0,5,6,8,3,8,2,6,2,8,-1],
  [1,5,6,2,1,6,-1],
  [1,3,6,1,6,10,3,8,6,5,6,9,8,9,6,-1],
  [10,1,0,10,0,6,9,5,0,5,6,0,-1],
  [0,3,8,5,6,10,-1],
  [10,5,6,-1],
  [11,5,10,7,5,11,-1],
  [11,5,10,11,7,5,8,3,0,-1],
  [5,11,7,5,10,11,1,9,0,-1],
  [10,7,5,10,11,7,9,8,1,8,3,1,-1],
  [11,1,2,11,7,1,7,5,1,-1],
  [0,8,3,1,2,7,1,7,5,7,2,11,-1],
  [9,7,5,9,2,7,9,0,2,2,11,7,-1],
  [7,5,2,7,2,11,5,9,2,3,2,8,9,8,2,-1],
  [2,5,10,2,3,5,3,7,5,-1],
  [8,2,0,8,5,2,8,7,5,10,2,5,-1],
  [9,0,1,5,10,3,5,3,7,3,10,2,-1],
  [9,8,2,9,2,1,8,7,2,10,2,5,7,5,2,-1],
  [1,3,5,3,7,5,-1],
  [0,8,7,0,7,1,1,7,5,-1],
  [9,0,3,9,3,5,5,3,7,-1],
  [9,8,7,5,9,7,-1],
  [5,8,4,5,10,8,10,11,8,-1],
  [5,0,4,5,11,0,5,10,11,11,3,0,-1],
  [0,1,9,8,4,10,8,10,11,10,4,5,-1],
  [10,11,4,10,4,5,11,3,4,9,4,1,3,1,4,-1],
  [2,5,1,2,8,5,2,11,8,4,5,8,-1],
  [0,4,11,0,11,3,4,5,11,2,11,1,5,1,11,-1],
  [0,2,5,0,5,9,2,11,5,4,5,8,11,8,5,-1],
  [9,4,5,2,11,3,-1],
  [2,5,10,3,5,2,3,4,5,3,8,4,-1],
  [5,10,2,5,2,4,4,2,0,-1],
  [3,10,2,3,5,10,3,8,5,4,5,8,0,1,9,-1],
  [5,10,2,5,2,4,1,9,2,9,4,2,-1],
  [8,4,5,8,5,3,3,5,1,-1],
  [0,4,5,1,0,5,-1],
  [8,4,5,8,5,3,9,0,5,0,3,5,-1],
  [9,4,5,-1],
  [4,11,7,4,9,11,9,10,11,-1],
  [0,8,3,4,9,7,9,11,7,9,10,11,-1],
  [1,10,11,1,11,4,1,4,0,7,4,11,-1],
  [3,1,4,3,4,8,1,10,4,7,4,11,10,11,4,-1],
  [4,11,7,9,11,4,9,2,11,9,1,2,-1],
  [9,7,4,9,11,7,9,1,11,2,11,1,0,8,3,-1],
  [11,7,4,11,4,2,2,4,0,-1],
  [11,7,4,11,4,2,8,3,4,3,2,4,-1],
  [2,9,10,2,7,9,2,3,7,7,4,9,-1],
  [9,10,7,9,7,4,10,2,7,8,7,0,2,0,7,-1],
  [3,7,10,3,10,2,7,4,10,1,10,0,4,0,10,-1],
  [1,10,2,8,7,4,-1],
  [4,9,1,4,1,7,7,1,3,-1],
  [4,9,1,4,1,7,0,8,1,8,7,1,-1],
  [4,0,3,7,4,3,-1],
  [4,8,7,-1],
  [9,10,8,10,11,8,-1],
  [3,0,9,3,9,11,11,9,10,-1],
  [0,1,10,0,10,8,8,10,11,-1],
  [3,1,10,11,3,10,-1],
  [1,2,11,1,11,9,9,11,8,-1],
  [3,0,9,3,9,11,1,2,9,2,11,9,-1],
  [0,2,11,8,0,11,-1],
  [3,2,11,-1],
  [2,3,8,2,8,10,10,8,9,-1],
  [9,10,2,0,9,2,-1],
  [2,3,8,2,8,10,0,1,8,1,10,8,-1],
  [1,10,2,-1],
  [1,3,8,9,1,8,-1],
  [0,9,1,-1],
  [0,3,8,-1],
  [-1]
];

// ─── Edge-to-vertex mapping ─────────────────────────────────────────────────
// Each of the 12 edges connects two of the 8 cube corners.
const EDGE_VERTICES = [
  [0,1],[1,2],[2,3],[3,0],
  [4,5],[5,6],[6,7],[7,4],
  [0,4],[1,5],[2,6],[3,7]
];

// Corner offsets in (x, y, z) for a unit cube
const CORNER_OFFSETS = [
  [0,0,0],[1,0,0],[1,1,0],[0,1,0],
  [0,0,1],[1,0,1],[1,1,1],[0,1,1]
];

// ─── Metaball scalar field ──────────────────────────────────────────────────
function metaballField(x, y, z, balls) {
  let sum = 0;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    const dx = x - b.x;
    const dy = y - b.y;
    const dz = z - b.z;
    const r2 = dx * dx + dy * dy + dz * dz;
    sum += b.strength / (r2 + 0.0001);
  }
  return sum;
}

// ─── Marching cubes extraction ──────────────────────────────────────────────
function marchingCubes(resolution, bounds, isoLevel, balls) {
  const positions = [];
  const step = (bounds.max - bounds.min) / resolution;

  // Cache the scalar field in a 3D grid
  const size = resolution + 1;
  const field = new Float32Array(size * size * size);
  for (let iz = 0; iz < size; iz++) {
    for (let iy = 0; iy < size; iy++) {
      for (let ix = 0; ix < size; ix++) {
        const x = bounds.min + ix * step;
        const y = bounds.min + iy * step;
        const z = bounds.min + iz * step;
        field[ix + iy * size + iz * size * size] = metaballField(x, y, z, balls);
      }
    }
  }

  function getField(ix, iy, iz) {
    return field[ix + iy * size + iz * size * size];
  }

  // March through each cube
  for (let iz = 0; iz < resolution; iz++) {
    for (let iy = 0; iy < resolution; iy++) {
      for (let ix = 0; ix < resolution; ix++) {
        // Evaluate the 8 corners
        const cornerValues = new Array(8);
        for (let c = 0; c < 8; c++) {
          const off = CORNER_OFFSETS[c];
          cornerValues[c] = getField(ix + off[0], iy + off[1], iz + off[2]);
        }

        // Determine cube index (which corners are inside the surface)
        let cubeIndex = 0;
        for (let c = 0; c < 8; c++) {
          if (cornerValues[c] > isoLevel) cubeIndex |= (1 << c);
        }

        const edges = EDGE_TABLE[cubeIndex];
        if (edges === 0) continue;

        // Interpolate edge vertices
        const edgeVerts = new Array(12);
        for (let e = 0; e < 12; e++) {
          if (!(edges & (1 << e))) continue;
          const [c0, c1] = EDGE_VERTICES[e];
          const v0 = cornerValues[c0];
          const v1 = cornerValues[c1];
          const t = (isoLevel - v0) / (v1 - v0 + 0.00001);
          const off0 = CORNER_OFFSETS[c0];
          const off1 = CORNER_OFFSETS[c1];
          edgeVerts[e] = [
            bounds.min + (ix + off0[0] + t * (off1[0] - off0[0])) * step,
            bounds.min + (iy + off0[1] + t * (off1[1] - off0[1])) * step,
            bounds.min + (iz + off0[2] + t * (off1[2] - off0[2])) * step
          ];
        }

        // Emit triangles
        const tris = TRI_TABLE[cubeIndex];
        for (let t = 0; t < tris.length; t += 3) {
          if (tris[t] === -1) break;
          const a = edgeVerts[tris[t]];
          const b = edgeVerts[tris[t + 1]];
          const c = edgeVerts[tris[t + 2]];
          if (a && b && c) {
            positions.push(a[0], a[1], a[2]);
            positions.push(b[0], b[1], b[2]);
            positions.push(c[0], c[1], c[2]);
          }
        }
      }
    }
  }

  return new Float32Array(positions);
}

// ─── Compute flat normals from triangle positions ───────────────────────────
function computeNormals(positions) {
  const normals = new Float32Array(positions.length);
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();

  for (let i = 0; i < positions.length; i += 9) {
    vA.set(positions[i], positions[i + 1], positions[i + 2]);
    vB.set(positions[i + 3], positions[i + 4], positions[i + 5]);
    vC.set(positions[i + 6], positions[i + 7], positions[i + 8]);
    ab.subVectors(vB, vA);
    ac.subVectors(vC, vA);
    ab.cross(ac).normalize();
    for (let j = 0; j < 3; j++) {
      normals[i + j * 3]     = ab.x;
      normals[i + j * 3 + 1] = ab.y;
      normals[i + j * 3 + 2] = ab.z;
    }
  }
  return normals;
}

// ─── Scene entry point ──────────────────────────────────────────────────────
export function init(canvas, container, palette) {
  const hex = palette.as.hex;
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(hex.bg, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(hex.bg, 6, 18);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 2, 6);

  // Lighting
  const ambient = new THREE.AmbientLight(hex.text, 0.35);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(hex.text, 1.2);
  key.position.set(4, 5, 3);
  scene.add(key);

  const fill = new THREE.DirectionalLight(hex.hues[4], 0.6);
  fill.position.set(-3, 2, -2);
  scene.add(fill);

  const rim = new THREE.PointLight(hex.accent, 0.8, 12);
  rim.position.set(0, -2, 4);
  scene.add(rim);

  // Isosurface mesh
  const material = new THREE.MeshStandardMaterial({
    color: hex.hues[4],
    metalness: 0.3,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });

  let geometry = new THREE.BufferGeometry();
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Metaballs configuration
  const balls = [
    { x: 0, y: 0, z: 0, strength: 1.2 },
    { x: 1, y: 0, z: 0, strength: 0.9 },
    { x: 0, y: 1, z: 0, strength: 0.8 },
    { x: 0, y: 0, z: 1, strength: 1.0 },
  ];

  const GRID_RES = 32;
  const BOUNDS = { min: -2.5, max: 2.5 };
  const ISO_LEVEL = 1.8;

  const clock = new THREE.Clock();
  let running = true;
  let frameCount = 0;

  function updateMetaballs(t) {
    balls[0].x = Math.sin(t * 0.7) * 1.0;
    balls[0].y = Math.cos(t * 0.5) * 0.8;
    balls[0].z = Math.sin(t * 0.3) * 0.6;

    balls[1].x = Math.cos(t * 0.6) * 1.2;
    balls[1].y = Math.sin(t * 0.8) * 0.5;
    balls[1].z = Math.cos(t * 0.4) * 1.0;

    balls[2].x = Math.sin(t * 0.4 + 2.0) * 0.8;
    balls[2].y = Math.cos(t * 0.9) * 1.1;
    balls[2].z = Math.sin(t * 0.7 + 1.0) * 0.7;

    balls[3].x = Math.cos(t * 0.5 + 1.5) * 0.9;
    balls[3].y = Math.sin(t * 0.6 + 0.5) * 0.7;
    balls[3].z = Math.cos(t * 0.8 + 2.5) * 1.1;
  }

  function rebuildMesh() {
    const positions = marchingCubes(GRID_RES, BOUNDS, ISO_LEVEL, balls);
    const normals = computeNormals(positions);

    if (geometry) geometry.dispose();
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    mesh.geometry = geometry;
  }

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();
    frameCount++;

    // Rebuild surface every 2 frames for performance
    if (frameCount % 2 === 0) {
      updateMetaballs(t);
      rebuildMesh();
    }

    // Gentle camera orbit
    camera.position.x = Math.sin(t * 0.2) * 5;
    camera.position.z = Math.cos(t * 0.2) * 5;
    camera.position.y = 2 + Math.sin(t * 0.15) * 1.0;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight || 420;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  return () => {
    running = false;
    window.removeEventListener('resize', onResize);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
