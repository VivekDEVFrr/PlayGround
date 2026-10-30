/* =========================================================
   Evergreen SMP — hero diorama
   A hand-built voxel island rendered with Three.js.
   Exposes a tiny controller for drag-to-orbit + device tilt.
   ========================================================= */
import * as THREE from '../../vendor/three.module.js';

const TYPES = {
  grass:   { color: 0x4da263, roughness: .95, metalness: 0, jitter: .07 },
  grassHi: { color: 0x63bb72, roughness: .92, metalness: 0, jitter: .06 },
  dirt:    { color: 0x83593a, roughness: 1, metalness: 0, jitter: .1 },
  stone:   { color: 0x66776e, roughness: .95, metalness: .04, jitter: .1 },
  stoneHi: { color: 0x7b8d83, roughness: .9, metalness: .04, jitter: .08 },
  trunk:   { color: 0x6a4a30, roughness: 1, metalness: 0, jitter: .08 },
  leaves:  { color: 0x2f9f60, roughness: .9, metalness: 0, jitter: .14 },
  leavesHi:{ color: 0x45b96f, roughness: .88, metalness: 0, jitter: .12 },
  water:   { color: 0x5fd4e6, emissive: 0x0d4a55, emissiveIntensity: .5, roughness: .16, metalness: .2, opacity: .86, transparent: true, jitter: .05 },
  path:    { color: 0x9c9a8c, roughness: .95, metalness: 0, jitter: .1 },
  wall:    { color: 0xd9d0b8, roughness: .9, metalness: 0, jitter: .05 },
  roof:    { color: 0xa9533d, roughness: .82, metalness: .02, jitter: .12 },
  roofSlab:{ color: 0xb85e45, roughness: .82, metalness: .02, jitter: .12 },
  window:  { color: 0xffd79a, emissive: 0xffa93d, emissiveIntensity: 1.15, roughness: .5, jitter: .04 },
  crop:    { color: 0xd6d96d, roughness: .95, metalness: 0, jitter: .1 },
  gold:    { color: 0xf4c96c, emissive: 0xd99b2c, emissiveIntensity: .55, roughness: .35, metalness: .55, jitter: .05 },
  vine:    { color: 0x2b7c4e, roughness: 1, metalness: 0, jitter: .12 },
  sand:    { color: 0xc9bb92, roughness: 1, metalness: 0, jitter: .08 },
};

const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + 74.7) * 43758.5453123;
  return s - Math.floor(s);
};
const smooth = (t) => t * t * (3 - 2 * t);
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, y) {
  return noise(x, y) * .6 + noise(x * 2.1 + 4, y * 2.1 - 3) * .28 + noise(x * 4.3 - 1, y * 4.3 + 7) * .12;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(.28, 'rgba(220,255,236,.75)');
  grad.addColorStop(1, 'rgba(160,255,210,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function initHeroScene(canvas, options = {}) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = canvas.closest('.hero') || canvas.parentElement;
  const state = { dragging: false, tilt: false, auto: !reduceMotion, lastInteraction: 0, dy: 0 };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  camera.position.set(1.5, 13, 25);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xd8ffee, 0x0d2419, 1.12);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe7bd, 1.7);
  sun.position.set(12, 22, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x74f2c4, 1.05);
  rim.position.set(-14, 9, -12);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x9ad8ff, .62);
  fill.position.set(-4, 7, 20);
  scene.add(fill);

  scene.add(new THREE.AmbientLight(0x1f4a38, .38));

  const under = new THREE.DirectionalLight(0x3fd6a0, .38);
  under.position.set(0, -14, 8);
  scene.add(under);

  const waterGlow = new THREE.PointLight(0x54d7e6, 18, 26, 2);
  waterGlow.position.set(2.5, 3, 4.5);
  scene.add(waterGlow);

  // ---------- island ----------
  const island = new THREE.Group();
  scene.add(island);
  const pivot = new THREE.Group();          // rotates for orbit
  const bob = new THREE.Group();            // vertical float
  island.add(pivot);
  pivot.add(bob);

  const buckets = new Map();
  const jitterColor = new THREE.Color();

  function put(type, x, y, z, shade) {
    if (!TYPES[type]) return;
    let arr = buckets.get(type);
    if (!arr) { arr = []; buckets.set(type, arr); }
    arr.push([x, y, z, shade ?? (.9 + hash(x * 3.1 + y, z * 2.7 - y) * .22)]);
  }

  // pond footprint is cut out of the terrain before it is placed
  const pond = { x: 3, z: 5, rx: 3.2, rz: 2.4 };
  const pondAt = (x, z) => ((x - pond.x) / pond.rx) ** 2 + ((z - pond.z) / pond.rz) ** 2;

  // terrain
  const R = 10.6;
  const heights = new Map();
  for (let x = -13; x <= 13; x++) {
    for (let z = -13; z <= 13; z++) {
      const d = Math.hypot(x, z);
      const edge = R + (fbm(x * .16 + 3, z * .16 - 2) - .5) * 2.4;
      if (d > edge) continue;
      const h = Math.round(2.4 + fbm(x * .2, z * .2) * 2.2);
      heights.set(x + ',' + z, h);
      const water = pondAt(x, z);

      if (water <= 1) {
        // pond: water surface flush with the ground, sand bed below
        put('water', x, h, z, .96);
        put('sand', x, h - 1, z);
        put('stone', x, h - 2, z);
      } else if (water <= 1.3) {
        put('sand', x, h, z, .95);
        put('dirt', x, h - 1, z);
      } else {
        put(hash(x, z) > .82 ? 'grassHi' : 'grass', x, h, z);
        put('dirt', x, h - 1, z);
        put('dirt', x, h - 2, z);
      }

      // tapered underside
      const depth = Math.max(1, Math.round((1 - d / edge) * 7.5));
      for (let i = 3; i <= 3 + depth; i++) {
        if (hash(x + i * 1.7, z - i * 2.3) < .03) continue;
        put((i + x + z) % 3 === 0 ? 'stoneHi' : 'stone', x, h - i, z);
      }

      // hanging vines off the rim
      if (d > edge - 1.2 && hash(x * 2.2, z * 1.9) > .9) {
        put('vine', x, h - 3, z);
        if (hash(x, z * 3.3) > .55) put('vine', x, h - 4, z);
      }
    }
  }

  const H = (x, z) => heights.get(x + ',' + z) ?? 4;

  // path from the house door down to the pond
  const pathPoints = [
    [-3, -3], [-3, -2], [-4, -1], [-4, 0], [-4, 1], [-3, 2], [-2, 3], [-1, 3], [0, 4], [1, 4], [2, 4],
  ];
  pathPoints.forEach(([px, pz], i) => {
    for (let dx = 0; dx <= 1; dx++) {
      for (let dz = 0; dz <= 1; dz++) {
        const x = px + dx, z = pz + dz;
        if (pondAt(x, z) <= 1) continue;
        const y = H(x, z);
        put(i % 2 ? 'path' : 'stoneHi', x, y, z, .98);
      }
    }
  });

  // ---------- little cottage ----------
  const hx = -4, hz = -6;
  const baseY = Math.max(H(hx, hz), H(hx + 3, hz + 2));
  for (let x = 0; x < 4; x++) {
    for (let z = 0; z < 3; z++) {
      const gy = baseY;
      for (let y = H(hx + x, hz + z); y < gy; y++) put('stone', hx + x, y, hz + z, .9);
      put('path', hx + x, gy, hz + z, .9);
      for (let y = 1; y <= 3; y++) {
        const edgeX = x === 0 || x === 3;
        const edgeZ = z === 0 || z === 2;
        if (!edgeX && !edgeZ) continue;
        if (edgeX && edgeZ) { put('trunk', hx + x, gy + y, hz + z, .95); continue; }
        if (z === 2 && x === 1 && y <= 2) continue;               // door
        if (y === 2 && ((z === 2 && x === 2) || (x === 0 && z === 1) || (x === 3 && z === 0))) {
          put('window', hx + x, gy + y, hz + z);
          continue;
        }
        put('wall', hx + x, gy + y, hz + z, .97 + hash(x, z) * .05);
      }
    }
  }
  // pitched roof: stepped half-blocks, ridge along x
  for (let z = -1; z <= 3; z++) {
    const lift = z === 1 ? 1 : (z === 0 || z === 2 ? .5 : 0);
    for (let x = 0; x < 4; x++) {
      put('roofSlab', hx + x, baseY + 3.5 + lift, hz + z, .9 + hash(x, z) * .12);
    }
  }
  // ridge cap + chimney
  for (let x = 0; x < 4; x++) put('roof', hx + x, baseY + 4.75, hz + 1, .95);
  put('stone', hx + 3, baseY + 4.2, hz, .92);
  put('stone', hx + 3, baseY + 5.2, hz, .92);

  // little dock reaching into the pond
  for (let x = 5; x <= 7; x++) {
    put('path', x, H(x, 5), 5, .95);
    put('trunk', x, H(x, 5) + 1, 6, .9);
  }

  // ---------- trees ----------
  function tree(tx, tz, size = 1) {
    const gy = H(tx, tz);
    const trunkH = 3 + Math.round(hash(tx, tz) * 2);
    for (let y = 1; y <= trunkH; y++) put('trunk', tx, gy + y, tz, .92 + y * .015);
    const topY = gy + trunkH;
    const r = 2.1 * size;
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        for (let y = -1; y <= 2; y++) {
          const d = Math.sqrt(x * x + y * y * 1.25 + z * z);
          if (d > r) continue;
          if (d > r - .75 && hash(tx + x * 1.3, tz + z * .9 + y) < .42) continue;
          const leaf = hash(tx + x + y * 3, tz + z) > .55 ? 'leavesHi' : 'leaves';
          put(leaf, tx + x, topY + y, tz + z, .92 + hash(x + y, z) * .16);
        }
      }
    }
  }
  tree(7, -5, 1.05);
  tree(-7, 7, .92);
  tree(1, -7, .95);
  tree(8, 2, .8);

  // ---------- farm ----------
  for (let x = -8; x <= -5; x++) {
    for (let z = 2; z <= 5; z++) {
      const gy = H(x, z);
      put('dirt', x, gy, z, .95);
      if ((x + z) % 2 === 0) put('crop', x, gy + 1, z, .95 + hash(x, z) * .1);
      else put('water', x, gy + 1, z, .8);
    }
  }
  // fence posts
  for (let x = -9; x <= -4; x += 5) {
    for (let z = 1; z <= 6; z += 5) put('trunk', x, H(x, z) + 1, z, .9);
  }

  // ---------- crystal shrine ----------
  const cx = 6, cz = -1;
  const cy = H(cx, cz);
  for (let y = 1; y <= 2; y++) put('stoneHi', cx, cy + y, cz, .98);
  put('gold', cx, cy + 3, cz, 1);
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put('stoneHi', cx + dx, cy + 1, cz + dz, .95);

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(.72, 0),
    new THREE.MeshStandardMaterial({
      color: 0x7df0cd,
      emissive: 0x38e5b0,
      emissiveIntensity: .6,
      roughness: .15,
      metalness: .35,
      transparent: true,
      opacity: .92,
    })
  );
  crystal.position.set(cx, cy + 4.2, cz);
  crystal.castShadow = true;
  pivot.add(crystal);

  const crystalLight = new THREE.PointLight(0x54f0c0, 26, 22, 2);
  crystalLight.position.copy(crystal.position);
  pivot.add(crystalLight);

  const crystalHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0x5cf0c0, transparent: true, opacity: .55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  crystalHalo.scale.setScalar(6);
  crystalHalo.position.copy(crystal.position);
  pivot.add(crystalHalo);

  // ---------- clouds ----------
  function cloud(x, y, z, s) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd9fff0, roughness: 1, metalness: 0, transparent: true, opacity: .1,
    });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const blocks = [[0, 0, 0, 3, .7, 1.6], [2, .1, .2, 2, .6, 1.2], [-2, -.1, -.1, 2, .5, 1.1]];
    for (const [bx, by, bz, w, h, d] of blocks) {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(w, h, d);
      m.position.set(bx, by, bz);
      g.add(m);
    }
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    scene.add(g);
    return g;
  }
  const clouds = [cloud(-16, 15, -12, 1.15), cloud(17, 19, -16, .9), cloud(4, 23, -22, .75)];

  // ---------- floating mini-islands ----------
  const chunkGroup = new THREE.Group();
  bob.add(chunkGroup);
  const chunkGeo = new THREE.BoxGeometry(.9, .9, .9);
  const chunkGrass = new THREE.MeshStandardMaterial({ color: 0x4fa762, roughness: .95 });
  const chunkDirt = new THREE.MeshStandardMaterial({ color: 0x6f4b31, roughness: 1 });
  const chunkStone = new THREE.MeshStandardMaterial({ color: 0x5c6d64, roughness: 1 });
  for (let i = 0; i < 7; i++) {
    const a = (hash(i, 2) - .5) * 2.3;
    const rad = 15 + hash(i, 7) * 5;
    const g = new THREE.Group();
    const add = (x, y, z, mat) => {
      const m = new THREE.Mesh(chunkGeo, mat);
      m.position.set(x * .9, y * .9, z * .9);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    };
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        if (Math.abs(x) === 1 && Math.abs(z) === 1) continue;
        add(x, 0, z, chunkGrass);
        add(x, -1, z, chunkDirt);
      }
    }
    add(0, -2, 0, chunkStone);
    add(0, -3, 0, chunkStone);
    g.position.set(Math.cos(a) * rad, 2.5 + hash(i, 3) * 7, Math.sin(a) * rad);
    g.scale.setScalar(.55 + hash(i, 9) * .35);
    g.rotation.y = hash(i, 1) * Math.PI;
    g.userData.spin = .08 + hash(i, 4) * .16;
    g.userData.phase = hash(i, 5) * Math.PI * 2;
    g.userData.y = g.position.y;
    chunkGroup.add(g);
  }

  // ---------- flowers ----------
  const flora = [];
  const FLOWER_COLORS = [0xff8fa3, 0xffd166, 0xf3f1de, 0xb892ff, 0xff9f6e];
  const blocked = (x, z) => {
    if (pondAt(x, z) <= 1.35) return true;
    if (x >= hx - 1 && x <= hx + 4 && z >= hz - 1 && z <= hz + 4) return true;
    if (x >= -9 && x <= -4 && z >= 1 && z <= 6) return true;
    for (const [px, pz] of pathPoints) if (x >= px && x <= px + 2 && z >= pz && z <= pz + 2) return true;
    return false;
  };
  for (let x = -11; x <= 11; x++) {
    for (let z = -11; z <= 11; z++) {
      if (!heights.has(x + ',' + z)) continue;
      if (blocked(x, z)) continue;
      const r = hash(x * 1.9 + 5, z * 2.3 - 7);
      if (r < .82) continue;
      const color = FLOWER_COLORS[Math.floor(hash(x + 2, z + 9) * FLOWER_COLORS.length)];
      flora.push([x + (hash(x, z) - .5) * .4, H(x, z) + .5, z + (hash(z, x) - .5) * .4, color]);
    }
  }
  if (flora.length) {
    const fmat = new THREE.MeshStandardMaterial({ roughness: .8, metalness: 0 });
    const fmesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.34, .34, .34), fmat, flora.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3(1, 1, 1);
    const v = new THREE.Vector3();
    const col = new THREE.Color();
    flora.forEach(([x, y, z, color], i) => {
      v.set(x, y, z);
      m.compose(v, q, sc);
      fmesh.setMatrixAt(i, m);
      col.setHex(color);
      fmesh.setColorAt(i, col);
    });
    fmesh.castShadow = false;
    fmesh.receiveShadow = false;
    bob.add(fmesh);
  }

  // ---------- build instanced meshes ----------
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const slabGeo = new THREE.BoxGeometry(1, .5, 1);
  const meshes = [];
  for (const [type, items] of buckets) {
    const spec = TYPES[type];
    const material = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: spec.roughness ?? .9,
      metalness: spec.metalness ?? 0,
      emissive: spec.emissive ?? 0x000000,
      emissiveIntensity: spec.emissiveIntensity ?? 0,
      transparent: !!spec.transparent,
      opacity: spec.opacity ?? 1,
    });
    const mesh = new THREE.InstancedMesh(type === 'roofSlab' ? slabGeo : geo, material, items.length);
    mesh.castShadow = type !== 'water';
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const m4 = new THREE.Matrix4();
    items.forEach(([x, y, z, shade], i) => {
      m4.makeTranslation(x, y, z);
      mesh.setMatrixAt(i, m4);
      jitterColor.setRGB(1, 1, 1).multiplyScalar(shade ?? 1);
      mesh.setColorAt(i, jitterColor);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    bob.add(mesh);
    meshes.push(mesh);
  }

  // ---------- fireflies ----------
  const fireflyCount = 110;
  const ffPos = new Float32Array(fireflyCount * 3);
  const ffBase = [];
  for (let i = 0; i < fireflyCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * 12;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = 1 + Math.random() * 9;
    ffPos.set([x, y, z], i * 3);
    ffBase.push({ x, y, z, p: Math.random() * Math.PI * 2, s: .5 + Math.random() });
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const ffMat = new THREE.PointsMaterial({
    size: 1.15,
    map: glowTexture(),
    color: 0x9dffc9,
    transparent: true,
    opacity: .85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const fireflies = new THREE.Points(ffGeo, ffMat);
  bob.add(fireflies);

  // ---------- stars ----------
  const starCount = 420;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(48 + Math.random() * 70);
    v.y = Math.abs(v.y) * .8 + 2;
    starPos.set([v.x, v.y, v.z], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xcdfbe4, size: .55, transparent: true, opacity: .7, depthWrite: false,
  }));
  scene.add(stars);

  // soft halo under the island
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0x3ee79f, transparent: true, opacity: .22,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.scale.set(34, 20, 1);
  halo.position.set(0, -8, 0);
  bob.add(halo);

  // ---------- framing ----------
  let viewW = 1, viewH = 1;
  const camBase = { x: 0, y: 18, z: 46 };
  function layout() {
    const rect = canvas.getBoundingClientRect();
    viewW = Math.max(1, rect.width);
    viewH = Math.max(1, rect.height);
    renderer.setSize(viewW, viewH, false);
    const aspect = viewW / viewH;
    camera.aspect = aspect;
    if (aspect < .8) {
      camera.fov = 46;
      camBase.x = 0; camBase.y = 15; camBase.z = 54;
      island.position.set(0, -3.4, 0);
      camera.lookAt(0, 3.2, 0);
    } else if (aspect < 1.35) {
      camera.fov = 38;
      camBase.x = 0; camBase.y = 17; camBase.z = 48;
      island.position.set(0.4, -2, 0);
      island.scale.setScalar(1);
      camera.lookAt(0.4, 2, 0);
    } else {
      camera.fov = 30;
      camBase.x = 0; camBase.y = 19; camBase.z = 47;
      island.position.set(8.3, -1.9, 0);
      island.scale.setScalar(.88);
      camera.lookAt(1.7, 1.2, 0);
    }
    camera.position.set(camBase.x, camBase.y, camBase.z);
    camera.updateProjectionMatrix();
  }
  layout();

  const ro = new ResizeObserver(layout);
  ro.observe(canvas.parentElement || canvas);

  // ---------- interaction ----------
  let azimuth = -0.35;
  let targetAzimuth = azimuth;
  let elevation = 0;
  let targetElevation = 0;
  let pointerX = 0, pointerY = 0, targetPointerX = 0, targetPointerY = 0;
  let last = 0;

  function pointerDown(e) {
    if (e.target.closest('a, button, input, select, textarea, label')) return;
    state.dragging = true;
    last = e.clientX;
    hero.classList.add('is-dragging');
    state.lastInteraction = performance.now();
  }
  function pointerUp() {
    state.dragging = false;
    hero.classList.remove('is-dragging');
    state.lastInteraction = performance.now();
  }
  function pointerMove(e) {
    if (state.dragging) {
      targetAzimuth += (e.clientX - last) * 0.006;
      last = e.clientX;
      state.lastInteraction = performance.now();
    } else if (e.pointerType === 'mouse') {
      const r = hero.getBoundingClientRect();
      targetPointerX = ((e.clientX - r.left) / r.width - .5) * 2;
      targetPointerY = ((e.clientY - r.top) / r.height - .5) * 2;
    }
  }
  hero.addEventListener('pointerdown', pointerDown);
  hero.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerUp);

  // ---------- tilt ----------
  let tiltHandler = null;
  function onTilt(e) {
    if (e.gamma == null || e.beta == null) return;
    const gamma = Math.max(-45, Math.min(45, e.gamma));
    const beta = Math.max(0, Math.min(90, e.beta));
    targetAzimuth = -0.35 - gamma * 0.016;
    targetElevation = (beta - 45) * 0.006;
  }
  function enableTilt() {
    state.tilt = true;
    tiltHandler = onTilt;
    window.addEventListener('deviceorientation', tiltHandler, true);
    state.lastInteraction = performance.now();
  }
  function disableTilt() {
    state.tilt = false;
    if (tiltHandler) window.removeEventListener('deviceorientation', tiltHandler, true);
    tiltHandler = null;
    targetElevation = 0;
  }
  async function requestTilt() {
    const api = window.DeviceOrientationEvent;
    if (!api) return false;
    if (typeof api.requestPermission === 'function') {
      try {
        const res = await api.requestPermission();
        if (res !== 'granted') return false;
      } catch { return false; }
    }
    enableTilt();
    return true;
  }

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let running = true;
  let visible = true;
  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  }, { threshold: 0 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { clock.getDelta(); animate(); }
  });

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), .05);
    if (!visible) return;
    const t = clock.elapsedTime;

    // idle auto-orbit
    if (state.auto && !state.dragging && !state.tilt) {
      const idle = performance.now() - state.lastInteraction;
      if (idle > 2600) targetAzimuth += dt * 0.075;
    }

    azimuth += (targetAzimuth - azimuth) * Math.min(1, dt * 4.5);
    elevation += (targetElevation - elevation) * Math.min(1, dt * 3);
    pointerX += (targetPointerX - pointerX) * Math.min(1, dt * 3);
    pointerY += (targetPointerY - pointerY) * Math.min(1, dt * 3);

    pivot.rotation.y = azimuth;
    bob.position.y = reduceMotion ? 0 : Math.sin(t * .55) * .22;
    bob.rotation.z = reduceMotion ? 0 : Math.sin(t * .32) * .012;

    camera.position.x = camBase.x + pointerX * 1.1;
    camera.position.y = camBase.y - pointerY * .7 + elevation * 9;
    camera.position.z = camBase.z;
    camera.lookAt(island.position.x * .42, 1.4, 0);

    crystal.rotation.y = t * .55;
    crystal.position.y = (H(cx, cz) + 4.2) + (reduceMotion ? 0 : Math.sin(t * 1.1) * .18);
    crystalLight.intensity = 16 + Math.sin(t * 2.1) * 4;
    crystalHalo.position.copy(crystal.position);
    crystalHalo.material.opacity = .24 + Math.sin(t * 2.1) * .06;

    // fireflies
    const arr = ffGeo.attributes.position.array;
    for (let i = 0; i < fireflyCount; i++) {
      const b = ffBase[i];
      arr[i * 3] = b.x + Math.sin(t * .35 * b.s + b.p) * .9;
      arr[i * 3 + 1] = b.y + Math.sin(t * .8 * b.s + b.p * 1.7) * .7;
      arr[i * 3 + 2] = b.z + Math.cos(t * .3 * b.s + b.p) * .9;
    }
    ffGeo.attributes.position.needsUpdate = true;
    ffMat.opacity = .65 + Math.sin(t * 1.3) * .15;

    chunkGroup.children.forEach((g) => {
      g.rotation.y = t * g.userData.spin;
      g.position.y = g.userData.y + (reduceMotion ? 0 : Math.sin(t * .6 + g.userData.phase) * .6);
    });
    chunkGroup.rotation.y = t * .03;

    clouds.forEach((c, i) => {
      c.position.x += dt * (.25 + i * .06);
      if (c.position.x > 26) c.position.x = -26;
      c.position.y += Math.sin(t * .2 + i) * dt * .1;
    });

    stars.rotation.y = t * .004;
    fireflies.rotation.y = t * .01;

    renderer.render(scene, camera);
  }
  animate();

  return {
    requestTilt,
    enableTilt,
    disableTilt,
    toggleTilt: async () => {
      if (state.tilt) { disableTilt(); return false; }
      return requestTilt();
    },
    dispose() {
      running = false;
      ro.disconnect();
      io.disconnect();
      renderer.dispose();
    },
  };
}
