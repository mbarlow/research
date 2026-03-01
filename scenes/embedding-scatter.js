// 3D Embedding Scatter Plot: ~90 word embeddings across 4 semantic clusters
// Exports init(canvas, container) -> cleanup function

import * as THREE from 'three';

export function init(canvas, container) {
  const width = container.clientWidth;
  const height = container.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08090f);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
  camera.position.set(0, 6, 18);
  camera.lookAt(0, 0, 0);

  // --- Cluster definitions ---
  // Each cluster has a center in 3D space, a color, and a list of words.
  // Positions are pre-computed fake projections (as if UMAP output).
  const clusters = [
    {
      name: 'Animals',
      center: [-5, 2, -3],
      color: new THREE.Color(0x4fc3f7),  // light blue
      words: [
        'cat', 'dog', 'fish', 'bird', 'horse', 'snake', 'whale', 'eagle',
        'rabbit', 'tiger', 'lion', 'bear', 'shark', 'wolf', 'deer', 'fox',
        'dolphin', 'parrot', 'owl', 'frog', 'monkey', 'penguin',
      ],
    },
    {
      name: 'Colors',
      center: [5, 3, -2],
      color: new THREE.Color(0xf06292),  // pink
      words: [
        'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'white',
        'black', 'pink', 'cyan', 'magenta', 'teal', 'crimson', 'gold',
        'silver', 'violet', 'indigo', 'maroon', 'beige', 'navy',
      ],
    },
    {
      name: 'Countries',
      center: [-4, -3, 4],
      color: new THREE.Color(0xaed581),  // light green
      words: [
        'france', 'japan', 'brazil', 'canada', 'germany', 'india', 'mexico',
        'egypt', 'italy', 'china', 'australia', 'kenya', 'sweden', 'chile',
        'spain', 'korea', 'nigeria', 'peru', 'norway', 'poland', 'turkey',
        'vietnam', 'greece',
      ],
    },
    {
      name: 'Food',
      center: [5, -2, 3],
      color: new THREE.Color(0xffb74d),  // orange
      words: [
        'pizza', 'rice', 'bread', 'apple', 'cheese', 'pasta', 'sushi',
        'steak', 'soup', 'taco', 'curry', 'salad', 'butter', 'noodles',
        'burger', 'mango', 'cake', 'honey', 'garlic', 'salmon', 'waffle',
        'yogurt', 'pretzel',
      ],
    },
  ];

  // --- Gaussian scatter helper ---
  function gaussRand() {
    // Box-Muller transform
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // --- Build all point data ---
  const allPositions = [];
  const allColors = [];
  const allSizes = [];
  const clusterIndices = [];  // which cluster each point belongs to
  const lineSegments = [];    // pairs of indices for nearest-neighbor lines

  let totalPoints = 0;
  const SCATTER = 1.2;  // gaussian scatter radius

  for (let ci = 0; ci < clusters.length; ci++) {
    const cluster = clusters[ci];
    const cx = cluster.center[0];
    const cy = cluster.center[1];
    const cz = cluster.center[2];

    for (let wi = 0; wi < cluster.words.length; wi++) {
      const x = cx + gaussRand() * SCATTER;
      const y = cy + gaussRand() * SCATTER;
      const z = cz + gaussRand() * SCATTER;

      allPositions.push(x, y, z);
      allColors.push(cluster.color.r, cluster.color.g, cluster.color.b);
      allSizes.push(3.0 + Math.random() * 2.0);
      clusterIndices.push(ci);
      totalPoints++;
    }
  }

  // --- Compute nearest-neighbor lines within each cluster ---
  const linePositions = [];
  const lineColors = [];

  for (let ci = 0; ci < clusters.length; ci++) {
    // Gather indices for this cluster
    const indices = [];
    for (let i = 0; i < totalPoints; i++) {
      if (clusterIndices[i] === ci) indices.push(i);
    }

    // For each point, find its 2 nearest neighbors within the cluster
    for (let a = 0; a < indices.length; a++) {
      const ai = indices[a];
      const ax = allPositions[ai * 3];
      const ay = allPositions[ai * 3 + 1];
      const az = allPositions[ai * 3 + 2];

      const distances = [];
      for (let b = 0; b < indices.length; b++) {
        if (a === b) continue;
        const bi = indices[b];
        const dx = allPositions[bi * 3] - ax;
        const dy = allPositions[bi * 3 + 1] - ay;
        const dz = allPositions[bi * 3 + 2] - az;
        distances.push({ idx: bi, dist: dx * dx + dy * dy + dz * dz });
      }
      distances.sort((a, b) => a.dist - b.dist);

      // Connect to 2 nearest neighbors
      const neighbors = Math.min(2, distances.length);
      for (let n = 0; n < neighbors; n++) {
        const bi = distances[n].idx;
        linePositions.push(
          ax, ay, az,
          allPositions[bi * 3], allPositions[bi * 3 + 1], allPositions[bi * 3 + 2]
        );
        const c = clusters[ci].color;
        lineColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
    }
  }

  // --- Points geometry ---
  const pointGeo = new THREE.BufferGeometry();
  pointGeo.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
  pointGeo.setAttribute('color', new THREE.Float32BufferAttribute(allColors, 3));
  pointGeo.setAttribute('size', new THREE.Float32BufferAttribute(allSizes, 1));

  const pointVert = `
    attribute float size;
    varying vec3 vColor;
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (180.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const pointFrag = `
    varying vec3 vColor;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float alpha = 1.0 - smoothstep(0.0, 0.5, d);
      alpha = pow(alpha, 1.6);
      gl_FragColor = vec4(vColor * 1.3, alpha * 0.9);
    }
  `;

  const pointMat = new THREE.ShaderMaterial({
    vertexShader: pointVert,
    fragmentShader: pointFrag,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(pointGeo, pointMat);
  scene.add(points);

  // --- Nearest-neighbor lines ---
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));

  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const lines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lines);

  // --- Legend overlay (HTML) ---
  const legend = document.createElement('div');
  legend.style.cssText =
    'position:absolute;top:12px;right:12px;font:12px/1.6 monospace;color:#ccc;' +
    'background:rgba(0,0,0,0.5);padding:8px 12px;border-radius:6px;pointer-events:none;';
  for (const cluster of clusters) {
    const row = document.createElement('div');
    const swatch = document.createElement('span');
    swatch.style.cssText =
      `display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;` +
      `background:#${cluster.color.getHexString()};`;
    row.appendChild(swatch);
    row.appendChild(document.createTextNode(cluster.name));
    legend.appendChild(row);
  }
  container.style.position = 'relative';
  container.appendChild(legend);

  // --- Animation ---
  const clock = new THREE.Clock();
  let running = true;

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();

    // Slow camera orbit
    const orbitSpeed = 0.12;
    const radius = 18;
    const camX = Math.sin(elapsed * orbitSpeed) * radius;
    const camZ = Math.cos(elapsed * orbitSpeed) * radius;
    const camY = 5 + Math.sin(elapsed * 0.08) * 2;
    camera.position.set(camX, camY, camZ);
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
    pointGeo.dispose();
    pointMat.dispose();
    lineGeo.dispose();
    lineMat.dispose();
    renderer.dispose();
    if (legend.parentNode) legend.parentNode.removeChild(legend);
  };
}
