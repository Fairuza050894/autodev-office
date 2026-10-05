// Builder humanoid rig untuk scripts/generate-characters.mjs (dijalankan di browser headless).
// Output: { group (SkinnedMesh + Skeleton), clips } siap GLTFExporter.
// Badan: lathe/kapsul/sfer/cone — TANPA Box. Props aksesori boleh bentuk sederhana.
import * as THREE from '../../apps/dashboard/node_modules/three/build/three.module.js';

const BONES = ['Hips', 'Spine', 'Head', 'UpperArmL', 'ForeArmL', 'UpperArmR', 'ForeArmR', 'ThighL', 'ShinL', 'ThighR', 'ShinR'];
const JI = Object.fromEntries(BONES.map((b, i) => [b, i]));
// Posisi lokal (relatif ke parent). Dunia: Hips 1.10, Spine 1.35, Head 1.90,
// UpperArm ±0.42/1.73, ForeArm ±0.42/1.31, Thigh ±0.16/1.05, Shin ±0.16/0.55.
const REST = {
  Hips: [0, 1.10, 0, null], Spine: [0, 0.25, 0, 'Hips'], Head: [0, 0.55, 0, 'Spine'],
  UpperArmL: [-0.42, 0.38, 0, 'Spine'], ForeArmL: [0, -0.42, 0, 'UpperArmL'],
  UpperArmR: [0.42, 0.38, 0, 'Spine'], ForeArmR: [0, -0.42, 0, 'UpperArmR'],
  ThighL: [-0.16, -0.05, 0, 'Hips'], ShinL: [0, -0.50, 0, 'ThighL'],
  ThighR: [0.16, -0.05, 0, 'Hips'], ShinR: [0, -0.50, 0, 'ThighR'],
};

const C = (hex) => new THREE.Color(hex);
function xform(geo, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz); geo.scale(sx, sy, sz); geo.translate(x, y, z);
  return geo;
}
function part(geo, colorHex, joint) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const col = C(colorHex);
  const carr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { carr[i * 3] = col.r; carr[i * 3 + 1] = col.g; carr[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(carr, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(n).fill(JI[joint]), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(n).fill(1), 4));
  return g;
}
function merge(parts) {
  let total = 0;
  for (const p of parts) total += p.attributes.position.count;
  const out = new THREE.BufferGeometry();
  const mk = (sz) => new Float32Array(total * sz);
  const P = mk(3), N = mk(3), U = mk(2), Cl = mk(3), SI = new Uint16Array(total * 4), SW = new Float32Array(total * 4);
  let o = 0;
  for (const p of parts) {
    const n = p.attributes.position.count;
    P.set(p.attributes.position.array, o * 3); N.set(p.attributes.normal.array, o * 3);
    U.set(p.attributes.uv.array, o * 2); Cl.set(p.attributes.color.array, o * 3);
    SI.set(p.attributes.skinIndex.array, o * 4); SW.set(p.attributes.skinWeight.array, o * 4);
    o += n;
  }
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  out.setAttribute('color', new THREE.BufferAttribute(Cl, 3));
  out.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
  out.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  return out;
}

function torsoGeo() {
  const pts = [[0.01, 0], [0.26, 0], [0.32, 0.10], [0.30, 0.30], [0.34, 0.48], [0.30, 0.62], [0.16, 0.68], [0.01, 0.68]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  return xform(new THREE.LatheGeometry(pts, 14), 0, 1.10, 0);
}
function headGeo() { return xform(new THREE.SphereGeometry(0.30, 18, 14), 0, 2.02, 0); }
function hairGeo(style, color) {
  void color;
  if (style === 1) { // sanggul
    const a = xform(new THREE.SphereGeometry(0.315, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, 2.06, -0.02);
    const b = xform(new THREE.SphereGeometry(0.13, 10, 8), 0, 2.36, -0.18);
    return [a, b];
  }
  if (style === 2) { // spike
    const parts = [xform(new THREE.SphereGeometry(0.315, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0, 2.06, -0.02)];
    for (let i = 0; i < 5; i++) {
      const c = new THREE.ConeGeometry(0.07, 0.22, 7);
      const a = (i / 5) * Math.PI * 2;
      parts.push(xform(c, Math.cos(a) * 0.20, 2.30, Math.sin(a) * 0.20, 1, 1, 1, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5));
    }
    return parts;
  }
  if (style === 3) { // panjang
    const pts = [new THREE.Vector2(0.32, 0), new THREE.Vector2(0.34, -0.25), new THREE.Vector2(0.30, -0.5)]
      .map(p => p);
    return [xform(new THREE.SphereGeometry(0.315, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, 2.06, -0.02),
      xform(new THREE.LatheGeometry(pts, 12, Math.PI * 0.6, Math.PI * 1.8), 0, 2.10, -0.05)];
  }
  return [xform(new THREE.SphereGeometry(0.315, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, 2.06, -0.02)]; // cepak
}
// Props peran (objek, bukan badan): bentuk sederhana, di-bind ke tulang terkait.
function accessoryGeo(kind) {
  const P = [];
  const put = (g, j) => P.push({ g, j });
  if (kind.includes('headset')) {
    put(xform(new THREE.TorusGeometry(0.31, 0.04, 8, 16, Math.PI), 0, 2.06, 0), 'Head');
    put(xform(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 10), -0.30, 2.02, 0, 1, 1, 1, 0, 0, Math.PI / 2), 'Head');
    put(xform(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 10), 0.30, 2.02, 0, 1, 1, 1, 0, 0, Math.PI / 2), 'Head');
  }
  if (kind.includes('helm')) {
    put(xform(new THREE.SphereGeometry(0.35, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, 2.08, 0), 'Head');
    put(xform(new THREE.BoxGeometry(0.40, 0.10, 0.06), 0, 2.02, 0.28), 'Head');
  }
  if (kind.includes('topi-proyek')) {
    put(xform(new THREE.CylinderGeometry(0.28, 0.32, 0.20, 14), 0, 2.34, 0), 'Head');
    put(xform(new THREE.CylinderGeometry(0.40, 0.40, 0.05, 14), 0, 2.24, 0), 'Head');
  }
  if (kind.includes('topi-datar')) {
    put(xform(new THREE.CylinderGeometry(0.30, 0.30, 0.10, 14), 0, 2.36, 0), 'Head');
    put(xform(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 14), 0, 2.31, 0), 'Head');
  }
  if (kind.includes('baret')) {
    put(xform(new THREE.CylinderGeometry(0.33, 0.29, 0.11, 14), 0.06, 2.38, 0, 1, 1, 1, 0, 0, -0.18), 'Head');
  }
  if (kind.includes('kacamata-bulat')) {
    for (const sx of [-0.12, 0.12]) put(xform(new THREE.TorusGeometry(0.085, 0.018, 6, 14), sx, 2.04, 0.26), 'Head');
  }
  if (kind.includes('kacamata') && !kind.includes('bulat')) {
    for (const sx of [-0.12, 0.12]) put(xform(new THREE.BoxGeometry(0.15, 0.09, 0.04), sx, 2.04, 0.26), 'Head');
  }
  if (kind.includes('laptop')) {
    put(xform(new THREE.BoxGeometry(0.42, 0.04, 0.30), 0.44, 1.02, 0.30), 'ForeArmR');
    put(xform(new THREE.BoxGeometry(0.42, 0.30, 0.03), 0.44, 1.16, 0.17, 1, 1, 1, -0.35, 0, 0), 'ForeArmR');
  }
  if (kind.includes('tablet') || kind.includes('ponsel-uji')) {
    put(xform(new THREE.BoxGeometry(0.22, 0.03, 0.30), 0.44, 1.00, 0.28), 'ForeArmR');
  }
  if (kind.includes('papan')) {
    put(xform(new THREE.BoxGeometry(0.34, 0.44, 0.03), -0.44, 1.05, 0.28), 'ForeArmL');
  }
  if (kind.includes('tas') || kind.includes('ransel')) {
    put(xform(new THREE.BoxGeometry(0.44, 0.55, 0.20), 0, 1.42, -0.33), 'Spine');
  }
  if (kind.includes('kamera-uji')) {
    put(xform(new THREE.BoxGeometry(0.20, 0.14, 0.24), -0.44, 1.02, 0.30), 'ForeArmL');
  }
  if (kind.includes('dasi')) {
    put(xform(new THREE.BoxGeometry(0.13, 0.40, 0.05), 0, 1.52, 0.30), 'Spine');
  }
  if (kind.includes('buku')) {
    put(xform(new THREE.BoxGeometry(0.24, 0.32, 0.07), -0.44, 1.02, 0.28), 'ForeArmL');
  }
  if (kind.includes('stempel') || kind.includes('kalkulator')) {
    put(xform(new THREE.BoxGeometry(0.14, 0.10, 0.20), 0.44, 1.00, 0.28), 'ForeArmR');
  }
  if (kind.includes('perisai')) {
    put(xform(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 6), -0.50, 1.15, 0.10, 1, 1, 1, Math.PI / 2, 0, 0), 'ForeArmL');
  }
  if (kind.includes('jubah-lead')) {
    put(xform(new THREE.CylinderGeometry(0.34, 0.44, 0.75, 12, 1, true), 0, 1.35, -0.12), 'Spine');
  }
  return P.map(({ g, j }) => ({ g, j, accent: true }));
}

const SKINS = ['#f1c9a5', '#e8b88a', '#c68e5e', '#8d5a2b'];
const HAIRS = ['#1c1917', '#3f2d20', '#6b4a2f', '#8a8f98'];

export function buildCharacter(spec) {
  const skin = SKINS[spec.i % SKINS.length];
  const hairC = HAIRS[(spec.i + 1) % HAIRS.length];
  const outfit = spec.color;
  const dark = '#232c52';
  const parts = [];
  parts.push(part(xform(new THREE.SphereGeometry(0.30, 12, 10), 0, 1.02, 0, 1.05, 0.75, 0.85), dark, 'Hips'));
  parts.push(part(torsoGeo(), outfit, 'Spine'));
  parts.push(part(xform(new THREE.BoxGeometry(0.001, 0.001, 0.001), 0, -10, 0), dark, 'Hips')); // no-op, menjaga grup
  parts.pop();
  parts.push(part(headGeo(), skin, 'Head'));
  for (const g of hairGeo(spec.i % 4)) parts.push(part(g, hairC, 'Head'));
  for (const sx of [-0.11, 0.11]) parts.push(part(xform(new THREE.SphereGeometry(0.042, 8, 8), sx, 2.05, 0.265), '#141a33', 'Head'));
  // Lencana peran di dada
  parts.push(part(xform(new THREE.CircleGeometry(0.07, 12), 0.17, 1.55, 0.315), spec.busy ? '#22c55e' : '#94a3b8', 'Spine'));
  for (const s of [-1, 1]) {
    const UA = s < 0 ? 'UpperArmL' : 'UpperArmR', FA = s < 0 ? 'ForeArmL' : 'ForeArmR';
    parts.push(part(xform(new THREE.CapsuleGeometry(0.11, 0.28, 3, 10), s * 0.42, 1.52, 0), outfit, UA));
    parts.push(part(xform(new THREE.SphereGeometry(0.12, 10, 8), s * 0.42, 1.73, 0), outfit, UA));
    parts.push(part(xform(new THREE.CapsuleGeometry(0.085, 0.26, 3, 10), s * 0.44, 1.10, 0), skin, FA));
    parts.push(part(xform(new THREE.SphereGeometry(0.10, 10, 8), s * 0.44, 0.90, 0), skin, FA));
    const TH = s < 0 ? 'ThighL' : 'ThighR', SH = s < 0 ? 'ShinL' : 'ShinR';
    parts.push(part(xform(new THREE.CapsuleGeometry(0.12, 0.26, 3, 10), s * 0.16, 0.80, 0), dark, TH));
    parts.push(part(xform(new THREE.CapsuleGeometry(0.085, 0.26, 3, 10), s * 0.16, 0.40, 0), '#3b4670', SH));
    parts.push(part(xform(new THREE.SphereGeometry(0.13, 10, 8), s * 0.16, 0.10, 0.05, 1, 0.65, 1.5), '#141a33', SH));
  }
  for (const { g, j } of accessoryGeo(spec.accessory))
    parts.push(part(g, outfit, j));

  const bones = {};
  for (const name of BONES) {
    const b = new THREE.Bone(); b.name = name;
    const [x, y, z, parent] = REST[name];
    b.position.set(x, y, z);
    bones[name] = b;
    if (parent) bones[parent].add(b);
  }
  const geo = merge(parts);
  const mtr = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05 });
  const mesh = new THREE.SkinnedMesh(geo, mtr);
  mesh.castShadow = true;
  mesh.name = 'body';
  mesh.add(bones.Hips);
  mesh.normalizeSkinWeights();
  const group = new THREE.Group();
  group.add(mesh);
  group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(Object.values(bones)));
  const clips = makeClips();
  // Validasi: mainkan tiap klip sesaat agar binding error ketahuan sebelum ekspor.
  const mixer = new THREE.AnimationMixer(group);
  for (const c of clips) { const a = mixer.clipAction(c); a.play(); mixer.update(0.1); mixer.update(0.1); a.stop(); }
  return { group, clips };
}

function Q(x = 0, y = 0, z = 0) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  return [q.x, q.y, q.z, q.w];
}
function QT(bone, keys) { // keys: [t, x,y,z euler]
  return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, keys.map(k => k[0]), keys.flatMap(k => Q(k[1], k[2], k[3])));
}
function PT(bone, rest, keys) { // keys: [t, dx,dy,dz]
  return new THREE.VectorKeyframeTrack(`${bone}.position`, keys.map(k => k[0]),
    keys.flatMap(k => [rest[0] + k[1], rest[1] + k[2], rest[2] + k[3]]));
}
const R = (n) => REST[n].slice(0, 3);
function makeClips() {
  const clips = [];
  const mk = (name, dur, tracks) => clips.push(new THREE.AnimationClip(name, dur, tracks));
  mk('idle', 2.4, [
    PT('Hips', R('Hips'), [[0, 0, 0, 0], [1.2, 0, 0.03, 0], [2.4, 0, 0, 0]]),
    QT('Head', [[0, 0, 0, 0], [1.2, 0.06, 0, 0], [2.4, 0, 0, 0]]),
    QT('UpperArmL', [[0, 0.05, 0, 0.04], [1.2, -0.05, 0, 0.04], [2.4, 0.05, 0, 0.04]]),
    QT('UpperArmR', [[0, -0.05, 0, -0.04], [1.2, 0.05, 0, -0.04], [2.4, -0.05, 0, -0.04]]),
  ]);
  mk('typing', 1.2, [
    QT('Head', [[0, 0.28, 0, 0], [0.6, 0.32, 0, 0], [1.2, 0.28, 0, 0]]),
    QT('UpperArmL', [[0, -0.35, 0, 0], [1.2, -0.35, 0, 0]]),
    QT('UpperArmR', [[0, -0.35, 0, 0], [1.2, -0.35, 0, 0]]),
    QT('ForeArmL', [[0, -0.9, 0, 0], [0.3, -0.78, 0, 0], [0.6, -0.9, 0, 0], [0.9, -0.78, 0, 0], [1.2, -0.9, 0, 0]]),
    QT('ForeArmR', [[0, -0.78, 0, 0], [0.3, -0.9, 0, 0], [0.6, -0.78, 0, 0], [0.9, -0.9, 0, 0], [1.2, -0.78, 0, 0]]),
  ]);
  mk('thinking', 3.0, [
    QT('Head', [[0, 0, 0, 0.16], [1.5, 0, 0.25, 0.16], [3.0, 0, 0, 0.16]]),
    QT('ForeArmR', [[0, -1.25, 0, 0], [3.0, -1.25, 0, 0]]),
    QT('UpperArmR', [[0, -0.5, 0, 0], [3.0, -0.5, 0, 0]]),
  ]);
  mk('walking', 1.0, [
    QT('ThighL', [[0, 0.5, 0, 0], [0.5, -0.5, 0, 0], [1.0, 0.5, 0, 0]]),
    QT('ThighR', [[0, -0.5, 0, 0], [0.5, 0.5, 0, 0], [1.0, -0.5, 0, 0]]),
    QT('ShinL', [[0, 0.15, 0, 0], [0.25, 0.55, 0, 0], [0.5, 0.15, 0, 0], [0.75, 0.55, 0, 0], [1.0, 0.15, 0, 0]]),
    QT('ShinR', [[0, 0.55, 0, 0], [0.25, 0.15, 0, 0], [0.5, 0.55, 0, 0], [0.75, 0.15, 0, 0], [1.0, 0.55, 0, 0]]),
    QT('UpperArmL', [[0, -0.4, 0, 0], [0.5, 0.4, 0, 0], [1.0, -0.4, 0, 0]]),
    QT('UpperArmR', [[0, 0.4, 0, 0], [0.5, -0.4, 0, 0], [1.0, 0.4, 0, 0]]),
    PT('Hips', R('Hips'), [[0, 0, 0, 0], [0.25, 0, 0.05, 0], [0.5, 0, 0, 0], [0.75, 0, 0.05, 0], [1.0, 0, 0, 0]]),
  ]);
  mk('talking', 1.6, [
    QT('Head', [[0, 0.1, 0, 0], [0.4, -0.06, 0.1, 0], [0.8, 0.1, 0, 0], [1.2, -0.06, -0.1, 0], [1.6, 0.1, 0, 0]]),
    QT('ForeArmR', [[0, -0.6, 0, 0], [0.4, -0.9, 0, 0.3], [0.8, -0.6, 0, 0], [1.2, -0.9, 0, -0.3], [1.6, -0.6, 0, 0]]),
  ]);
  mk('celebrate', 1.4, [
    QT('UpperArmL', [[0, 0, 0, 0], [0.35, -2.7, 0, 0.4], [1.4, -2.7, 0, 0.4]]),
    QT('UpperArmR', [[0, 0, 0, 0], [0.35, -2.7, 0, -0.4], [1.4, -2.7, 0, -0.4]]),
    PT('Hips', R('Hips'), [[0, 0, 0, 0], [0.35, 0, 0, 0], [0.7, 0, 0.22, 0], [1.05, 0, 0, 0], [1.4, 0, 0, 0]]),
    QT('Head', [[0, -0.15, 0, 0], [1.4, -0.15, 0, 0]]),
  ]);
  mk('handoff', 1.6, [
    QT('UpperArmR', [[0, 0, 0, 0], [0.4, -1.1, 0, 0], [1.2, -1.1, 0, 0], [1.6, 0, 0, 0]]),
    QT('ForeArmR', [[0, -0.3, 0, 0], [0.4, -0.25, 0, 0], [0.8, -0.35, 0, 0], [1.2, -0.25, 0, 0], [1.6, -0.3, 0, 0]]),
    QT('Spine', [[0, 0, 0, 0], [0.4, 0.15, 0, 0], [1.2, 0.15, 0, 0], [1.6, 0, 0, 0]]),
    QT('Head', [[0, 0.2, 0, 0], [0.4, 0.28, 0, 0], [1.2, 0.28, 0, 0], [1.6, 0.2, 0, 0]]),
  ]);
  mk('error', 1.2, [
    QT('Head', [[0, 0.3, 0.3, 0], [0.2, 0.3, -0.3, 0], [0.4, 0.3, 0.3, 0], [0.6, 0.3, -0.3, 0], [0.8, 0.3, 0.3, 0], [1.2, 0.3, 0, 0]]),
    QT('Spine', [[0, 0.3, 0, 0], [1.2, 0.3, 0, 0]]),
    QT('UpperArmL', [[0, 0.25, 0, 0], [1.2, 0.25, 0, 0]]),
    QT('UpperArmR', [[0, 0.25, 0, 0], [1.2, 0.25, 0, 0]]),
  ]);
  return clips;
}
