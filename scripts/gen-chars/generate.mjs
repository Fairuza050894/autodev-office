// Generate 19 .glb rig humanoid lokal (offline, tanpa unduh).
// Lisensi: karya sendiri untuk repo ini — bebas komersial.
// Jalankan: node scripts/gen-chars/generate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../apps/dashboard/node_modules/three/build/three.module.js';
import { GLTFExporter } from '../../apps/dashboard/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from '../../apps/dashboard/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { buildCharacter } from './builder.js';

globalThis.FileReader = class {
  readAsArrayBuffer(b) { b.arrayBuffer().then((ab) => { this.result = ab; this.onloadend?.(); }); }
  readAsDataURL(b) { b.arrayBuffer().then((ab) => { this.result = `data:;base64,${Buffer.from(ab).toString('base64')}`; this.onloadend?.(); }); }
};

const SPECS = [
  ['cs_agent', '#22d3ee', 'headset+mic'], ['account_agent', '#22d3ee', 'tablet+tas'],
  ['architect_agent', '#f59e0b', 'topi-proyek+lampu'], ['ba_agent', '#a78bfa', 'papan-kerja+dasi'],
  ['backend_dev', '#6366f1', 'laptop+headset'], ['frontend_dev', '#6366f1', 'laptop+headset'],
  ['mobile_dev', '#6366f1', 'ponsel-uji+headset'], ['data_agent', '#6366f1', 'ransel+kacamata'],
  ['designer_agent', '#e879f9', 'baret+kacamata-bulat'], ['writer_agent', '#e879f9', 'baret+buku'],
  ['qa_agent', '#22c55e', 'kacamata+kamera-uji'], ['security_agent', '#ef4444', 'helm+visor'],
  ['devops_agent', '#f59e0b', 'topi-proyek+tablet'], ['release_agent', '#f59e0b', 'topi-proyek+stempel'],
  ['pm_agent', '#a78bfa', 'topi-datar+dasi'], ['po_agent', '#a78bfa', 'topi-datar+papan'],
  ['tech_lead', '#6366f1', 'headset+jubah-lead'], ['compliance_agent', '#ef4444', 'helm+perisai'],
  ['estimator_agent', '#f59e0b', 'kalkulator+kacamata'],
];

const root = fileURLToPath(new URL('../..', import.meta.url));
const outDir = path.join(root, 'apps/dashboard/public/assets/characters');
fs.mkdirSync(outDir, { recursive: true });

const loader = new GLTFLoader();
let total = 0;
for (const [i, [id, color, accessory]] of SPECS.entries()) {
  const { group, clips } = buildCharacter({ i, color, accessory, busy: false });
  const mesh = group.children[0];
  const polys = Math.round(mesh.geometry.attributes.position.count / 3);
  if (polys > 40000) throw new Error(`${id}: ${polys} poligon melebihi 40k`);
  const buf = await new GLTFExporter().parseAsync(group, { binary: true, animations: clips, trs: true });
  const file = path.join(outDir, `${id}.glb`);
  fs.writeFileSync(file, Buffer.from(buf));
  // Validasi reload: SkinnedMesh + skeleton + semua klip playable
  const raw = fs.readFileSync(file);
  const gltf = await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
  const sk = gltf.scene.getObjectByName('body');
  if (!sk?.isSkinnedMesh) throw new Error(`${id}: reload tanpa SkinnedMesh`);
  const mx = new THREE.AnimationMixer(gltf.scene);
  for (const c of gltf.animations) { const a = mx.clipAction(c); a.play(); mx.update(0.5); a.stop(); }
  const kb = Math.round(buf.byteLength / 1024);
  total += buf.byteLength;
  console.log(`${id}.glb ${kb}KB ${polys}poly bones:${sk.skeleton.bones.length} clips:${gltf.animations.length}`);
}
console.log(`OK 19 file, total ${Math.round(total / 1024)}KB`);
