'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { parseRow, type Row } from '@autodev/ui';
import { isBusyAgent, officeFloors, roomOfAgent } from './office-data';
import { animFor, charEntry } from './character-manifest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

function textSprite(text: string, accent = '#a5b4fc', scale = 1): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(10,15,35,0.82)';
  g.beginPath();
  (g as CanvasRenderingContext2D & { roundRect: (...a: number[]) => void }).roundRect(4, 20, 504, 88, 18);
  g.fill();
  g.strokeStyle = accent;
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = '#eef1ff';
  g.font = '600 44px Inter, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text.slice(0, 18), 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(5.4 * scale, 1.35 * scale, 1);
  return sp;
}

function mat(color: string, emissive = 0, opacity = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.65, metalness: 0.2,
    emissive, emissiveIntensity: emissive ? 0.85 : 0,
    transparent: opacity < 1, opacity,
  });
}

function box(w: number, h: number, d: number, color: string, emissive = 0, opacity = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, emissive, opacity));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function deskSet(color = '#6366f1'): THREE.Group {
  const g = new THREE.Group();
  const top = box(3.4, 0.22, 1.7, '#46538c'); top.position.y = 1.05; g.add(top);
  const legL = box(0.18, 1.0, 1.4, '#232c52'); legL.position.set(-1.5, 0.5, 0); g.add(legL);
  const legR = box(0.18, 1.0, 1.4, '#232c52'); legR.position.set(1.5, 0.5, 0); g.add(legR);
  const mon = box(1.4, 0.9, 0.1, '#0b1020', 0x2a3fd4); mon.position.set(-0.4, 1.75, -0.3); g.add(mon);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshBasicMaterial({ color: 0x8ea2ff, transparent: true, opacity: 0.55 }));
  glow.position.set(-0.4, 1.75, -0.24); g.add(glow);
  const kb = box(1.1, 0.08, 0.4, '#1b2450'); kb.position.set(-0.4, 1.2, 0.5); g.add(kb);
  const chair = box(0.9, 0.55, 0.9, color); chair.position.set(0.3, 0.5, 1.7); g.add(chair);
  const chairBack = box(0.9, 0.8, 0.18, color); chairBack.position.set(0.3, 1.1, 2.05); g.add(chairBack);
  return g;
}

function loungeSet(color = '#22d3ee'): THREE.Group {
  const g = new THREE.Group();
  const sofa = box(3.2, 0.7, 1.2, color); sofa.position.y = 0.35; g.add(sofa);
  const back = box(3.2, 0.85, 0.32, color); back.position.set(0, 1.0, -0.55); g.add(back);
  const armL = box(0.32, 0.7, 1.2, color); armL.position.set(-1.6, 0.7, 0); g.add(armL);
  const armR = box(0.32, 0.7, 1.2, color); armR.position.set(1.6, 0.7, 0); g.add(armR);
  const table = box(1.6, 0.12, 0.9, '#8b98c4'); table.position.set(0, 0.5, 1.4); g.add(table);
  const tleg = box(1.2, 0.45, 0.6, '#232c52'); tleg.position.set(0, 0.22, 1.4); g.add(tleg);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), mat('#1c2653'));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.03, 1.0); rug.receiveShadow = true; g.add(rug);
  return g;
}

function rackSet(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const rack = box(1.2, 3.2, 1.0, '#1b2450', 0x113366);
    rack.position.set(i * 1.6 - 0.8, 1.6, 0);
    g.add(rack);
    for (let l = 0; l < 4; l++) {
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshBasicMaterial({ color: l % 2 ? '#22c55e' : '#22d3ee' }),
      );
      led.position.set(i * 1.6 - 0.8, 0.7 + l * 0.7, 0.55);
      led.userData.blink = true;
      g.add(led);
    }
  }
  const console_ = box(1.8, 0.9, 0.7, '#46538c'); console_.position.set(0, 0.45, 1.8); g.add(console_);
  const scr = box(1.5, 0.7, 0.08, '#0b1020', 0x22d3ee); scr.position.set(0, 1.3, 1.7); g.add(scr);
  return g;
}

function gymSet(): THREE.Group {
  const g = new THREE.Group();
  const bench = box(2.6, 0.45, 0.9, '#7c3aed'); bench.position.y = 0.45; g.add(bench);
  const rack = box(0.35, 1.6, 0.9, '#46538c'); rack.position.set(-1.1, 0.8, 0); g.add(rack);
  const matt = box(1.4, 0.1, 2.6, '#22c55e'); matt.position.set(1.8, 0.05, 0); g.add(matt);
  for (let i = 0; i < 3; i++) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 14), mat(i ? '#f59e0b' : '#6366f1'));
    plate.position.set(-1.1, 0.5 + i * 0.35, 0.55); plate.castShadow = true; g.add(plate);
  }
  return g;
}

function pantrySet(): THREE.Group {
  const g = new THREE.Group();
  const counter = box(3.4, 1.0, 1.0, '#8a5a2b'); counter.position.y = 0.5; g.add(counter);
  const top = box(3.6, 0.12, 1.2, '#e8ddc8'); top.position.y = 1.05; g.add(top);
  const shelf = box(3.0, 0.12, 0.6, '#46538c'); shelf.position.set(0, 2.2, -0.8); g.add(shelf);
  for (let i = 0; i < 4; i++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.4, 10), mat(i % 2 ? '#22d3ee' : '#f59e0b'));
    jar.position.set(-1.1 + i * 0.75, 2.45, -0.8); jar.castShadow = true; g.add(jar);
  }
  const table = box(2.2, 0.16, 2.2, '#8b98c4'); table.position.set(0, 0.9, 2.4); g.add(table);
  const tleg = box(0.3, 0.85, 0.3, '#232c52'); tleg.position.set(0, 0.45, 2.4); g.add(tleg);
  for (const [dx, dz] of [[-1.5, 2.4], [1.5, 2.4], [0, 3.6]] as const) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.85, 12), mat('#22d3ee'));
    stool.position.set(dx, 0.42, dz);
    stool.castShadow = true;
    g.add(stool);
  }
  return g;
}

function plant(x = 0, z = 0, s = 1): THREE.Group {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.28 * s, 0.5 * s, 10), mat('#b45309'));
  pot.position.y = 0.25 * s; pot.castShadow = true; g.add(pot);
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * s, 1), mat('#22c55e'));
  leaf.position.y = 1.0 * s; leaf.castShadow = true; g.add(leaf);
  const leaf2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38 * s, 1), mat('#4ade80'));
  leaf2.position.set(0.25 * s, 1.35 * s, 0.1); leaf2.castShadow = true; g.add(leaf2);
  g.position.set(x, 0, z);
  return g;
}

function tree(x: number, z: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.36 * s, 2.2 * s, 8), mat('#7c4a21'));
  trunk.position.y = 1.1 * s; trunk.castShadow = true; g.add(trunk);
  const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * s, 1), mat('#15803d'));
  c1.position.y = 2.9 * s; c1.castShadow = true; g.add(c1);
  const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 * s, 1), mat('#22c55e'));
  c2.position.set(0.6 * s, 3.6 * s, 0.3); c2.castShadow = true; g.add(c2);
  g.position.set(x, 0, z);
  return g;
}

function lampPost(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.4, 8), mat('#3b4670'));
  pole.position.y = 2.2; pole.castShadow = true; g.add(pole);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  bulb.position.y = 4.5; g.add(bulb);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.22 }));
  halo.position.y = 4.5; g.add(halo);
  g.position.set(x, 0, z);
  return g;
}

function furnitureFor(room: string): THREE.Group {
  if (/RECEPTION/.test(room)) { const g = new THREE.Group(); const c = box(4.2, 1.0, 0.9, '#6366f1'); c.position.y = 0.5; g.add(c); const s = loungeSet(); s.position.set(0, 0, 2.8); g.add(s); const p = plant(3.4, 2.6); g.add(p); return g; }
  if (/PM ROOM|RELEASE/.test(room)) { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.22, 20), mat('#8b98c4')); t.position.y = 1.0; t.castShadow = true; t.receiveShadow = true; g.add(t); const tleg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.0, 10), mat('#232c52')); tleg.position.y = 0.5; g.add(tleg); for (let i = 0; i < 4; i++) { const ch = box(0.7, 0.75, 0.7, '#6366f1'); const a = (i / 4) * Math.PI * 2; ch.position.set(Math.cos(a) * 2.6, 0.37, Math.sin(a) * 2.6); g.add(ch); } const board = box(2.4, 1.3, 0.1, '#e8ddc8', 0x445566); board.position.set(0, 2.2, -2.9); g.add(board); return g; }
  if (/SERVER|QA|SECURITY|DEVOPS/.test(room)) return rackSet();
  if (/GYM/.test(room)) return gymSet();
  if (/PANTRY/.test(room)) return pantrySet();
  if (/BA & PO|DESIGN|ARCHITECTURE/.test(room)) { const g = new THREE.Group(); const d1 = deskSet('#22d3ee'); g.add(d1); const d2 = deskSet('#a78bfa'); d2.position.set(0, 0, -3.4); d2.rotation.y = Math.PI; g.add(d2); const wb = box(2.6, 1.4, 0.1, '#e8ddc8', 0x334455); wb.position.set(-3.4, 2.1, -0.6); wb.rotation.y = Math.PI / 2; g.add(wb); g.add(plant(3.8, -2.4, 0.9)); return g; }
  if (/ROOFTOP|GAME|REST|LIBRARY/.test(room)) { const g = new THREE.Group(); const l = loungeSet(room.includes('GAME') ? '#a78bfa' : '#22d3ee'); g.add(l); g.add(plant(-3.6, 1.8, 1.1)); g.add(plant(3.6, 1.8, 0.9)); if (/LIBRARY/.test(room)) { for (let i = 0; i < 2; i++) { const sh = box(1.6, 2.4, 0.5, '#7c4a21'); sh.position.set(-1.2 + i * 2.4, 1.2, -3.0); g.add(sh); for (let b = 0; b < 3; b++) { const bk = box(1.4, 0.28, 0.35, i ? '#22d3ee' : '#f59e0b'); bk.position.set(-1.2 + i * 2.4, 0.6 + b * 0.65, -2.95); g.add(bk); } } } return g; }
  const g = deskSet();
  const extra = deskSet('#22d3ee');
  extra.position.set(0, 0, -3.2); extra.rotation.y = Math.PI;
  g.add(extra);
  return g;
}

export default function Office3D({ agents, tasks, onSelect, focusFloor = -1, resetToken = 0, spin = true }: { agents: Row[]; tasks: Row[]; onSelect: (r: Row) => void; focusFloor?: number; resetToken?: number; spin?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const focusRef = useRef(focusFloor);
  focusRef.current = focusFloor;
  const resetRef = useRef(resetToken);
  resetRef.current = resetToken;
  const spinRef = useRef(spin);
  spinRef.current = spin;
  const state = useRef({ agents, tasks });
  state.current = { agents, tasks };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      el.innerHTML = '<p class="muted">WebGL tidak tersedia di perangkat ini — gunakan denah 2D.</p>';
      return;
    }
    const small = el.clientWidth < 720;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b1020, 95, 230);
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 600);

    scene.add(new THREE.HemisphereLight(0xcdd8ff, 0x1a2040, 0.85));
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;
      pmrem.dispose();
    } catch { /* tanpa HDRI bila gagal */ }
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(30, 58, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -48; sun.shadow.camera.right = 48;
    sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -48;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x22d3ee, 0.4);
    fill.position.set(-28, 22, -30);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xa78bfa, 0.35);
    rim.position.set(0, 18, 45);
    scene.add(rim);

    // Plaza tanah: tanah + jalan lingkar + jalur + pohon + lampu
    const ground = new THREE.Mesh(new THREE.CircleGeometry(78, 56), mat('#0d1430'));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.3;
    ground.receiveShadow = true;
    scene.add(ground);
    const road = new THREE.Mesh(new THREE.RingGeometry(40, 48, 56), mat('#141c3d'));
    road.rotation.x = -Math.PI / 2; road.position.y = -1.22; road.receiveShadow = true;
    scene.add(road);
    const plaza = box(46, 0.35, 34, '#18224a');
    plaza.position.y = -1.05; plaza.receiveShadow = true;
    scene.add(plaza);
    const walkway = box(6, 0.4, 30, '#232f63');
    walkway.position.set(0, -1.02, 28); scene.add(walkway);
    [[-30, -18], [30, -18], [-30, 18], [30, 18], [-42, 0], [42, 0]].forEach(([x, z], i) => scene.add(tree(x, z, 0.9 + (i % 3) * 0.25)));
    [[-22, 12], [22, 12], [-22, -12], [22, -12]].forEach(([x, z]) => scene.add(lampPost(x, z)));

    const building = new THREE.Group();
    scene.add(building);
    const floorGroups: THREE.Group[] = [];
    const blinkers: THREE.Object3D[] = [];
    interface Rig { g: THREE.Group; base: THREE.Vector3; phase: number; mixer: THREE.AnimationMixer; clips: Map<string, THREE.AnimationClip>; cur: string; act: THREE.AnimationAction | null; agent: Row; label: THREE.Sprite }
    const rigs: Rig[] = [];
    const pickables: THREE.Object3D[] = [];

    const FW = 32, FD = 22, GAP = 10.5;
    const floorCols = ['#6366f1', '#22d3ee', '#a78bfa'];
    // Peta hunian: flatIndex -> agents
    const byRoom = new Map<number, number[]>();
    state.current.agents.forEach((a, ai) => {
      const gi = roomOfAgent(a, ai);
      if (!byRoom.has(gi)) byRoom.set(gi, []);
      byRoom.get(gi)!.push(ai);
    });
    const labels: THREE.Sprite[] = [];
    const roomLabels: THREE.Sprite[][] = [];
    const floorTags: THREE.Sprite[] = [];
    let flatBase = 0;
    officeFloors.forEach((fl, fi) => {
      const baseY = fi * GAP;
      const fg = new THREE.Group();
      building.add(fg);
      floorGroups.push(fg);
      const slab = box(FW + 2.5, 0.7, FD + 2.5, '#1a2350');
      slab.position.y = baseY;
      fg.add(slab);
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(FW + 2.6, 0.18, FD + 2.6),
        new THREE.MeshStandardMaterial({ color: floorCols[fi], emissive: floorCols[fi], emissiveIntensity: 0.35, roughness: 0.6 }),
      );
      edge.position.y = baseY + 0.42;
      edge.receiveShadow = true;
      fg.add(edge);
      // Kolom sudut + lampu gantung per lantai
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 4.6, 10), mat('#2b3768'));
        col.position.set(sx * (FW / 2 + 0.6), baseY + 2.6, sz * (FD / 2 + 0.6));
        col.castShadow = true;
        fg.add(col);
      }
      const pl = new THREE.PointLight(floorCols[fi], 14, 34, 1.8);
      pl.position.set(0, baseY + 6.5, 0);
      fg.add(pl);
      const cols = 3, cw = FW / cols, rows = Math.ceil(fl.rooms.length / cols), cd = FD / rows;
      fl.rooms.forEach((room, ri) => {
        const flat = flatBase + ri;
        const occ = (byRoom.get(flat) ?? []).map(ai => state.current.agents[ai]);
        const active = occ.some(isBusyAgent);
        const col = ri % cols, row = Math.floor(ri / cols);
        const cx = -FW / 2 + col * cw + cw / 2, cz = -FD / 2 + row * cd + cd / 2;
        const tile = box(cw - 0.7, 0.25, cd - 0.7, active ? '#2c3c82' : '#202a5c', active ? 0x1a2a88 : 0);
        tile.position.set(cx, baseY + 0.5, cz);
        fg.add(tile);
        const wallMat = new THREE.MeshStandardMaterial({ color: active ? 0x6d7bff : 0x39447c, roughness: 0.75, transparent: true, opacity: 0.92 });
        const back = new THREE.Mesh(new THREE.BoxGeometry(cw - 0.7, 2.5, 0.28), wallMat);
        back.position.set(cx, baseY + 1.7, cz - cd / 2 + 0.5);
        back.castShadow = true;
        fg.add(back);
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.5, cd - 0.7), wallMat);
        side.position.set(cx - cw / 2 + 0.5, baseY + 1.7, cz);
        side.castShadow = true;
        fg.add(side);
        // Dinding kaca depan: kesan kantor modern
        const glass = new THREE.Mesh(new THREE.BoxGeometry(cw - 0.7, 1.9, 0.12), new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.22 }));
        glass.position.set(cx, baseY + 1.5, cz + cd / 2 - 0.5);
        fg.add(glass);
        const mullion = box(cw - 0.7, 0.14, 0.16, '#8b98c4');
        mullion.position.set(cx, baseY + 2.45, cz + cd / 2 - 0.5);
        fg.add(mullion);
        // Lampu gantung + bola cahaya
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), new THREE.MeshBasicMaterial({ color: active ? 0x22d3ee : 0xffe9a8 }));
        bulb.position.set(cx, baseY + 4.3, cz);
        fg.add(bulb);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), mat('#232c52'));
        cord.position.set(cx, baseY + 5.2, cz);
        fg.add(cord);
        const furn = furnitureFor(room.name);
        furn.position.set(cx, baseY + 0.6, cz + 0.4);
        fg.add(furn);
        furn.traverse(o => { if ((o as THREE.Mesh).userData.blink) blinkers.push(o); });
        const label = textSprite(room.name, active ? '#22d3ee' : floorCols[fi]);
        label.position.set(cx, baseY + 4.2, cz);
        fg.add(label);
        labels.push(label);
        (roomLabels[fi] ??= []).push(label);
      });
      const tag = textSprite(fl.name.toUpperCase(), floorCols[fi], 0.85);
      tag.position.set(-FW / 2 - 7.2, baseY + 2.6, 0);
      fg.add(tag);
      labels.push(tag);
      floorTags.push(tag);
      flatBase += fl.rooms.length;
    });
    // Inti tangga/lift + atap
    const totalH = (officeFloors.length - 1) * GAP;
    const shaft = box(4.4, totalH + 5, 4.4, '#232c52');
    shaft.position.set(FW / 2 + 4.2, totalH / 2 + 1.5, -FD / 2 - 1.5);
    building.add(shaft);
    const shaftGlass = new THREE.Mesh(new THREE.BoxGeometry(4.5, totalH + 4, 0.3), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.5, transparent: true, opacity: 0.35 }));
    shaftGlass.position.set(FW / 2 + 4.2, totalH / 2 + 1.5, -FD / 2 + 0.9);
    building.add(shaftGlass);
    const roof = box(FW + 3.5, 0.25, FD + 3.5, '#93c5fd', 0, 0.12);
    roof.position.y = totalH + 5.6;
    roof.castShadow = false;
    building.add(roof);
    const roofFrame = new THREE.Mesh(new THREE.BoxGeometry(FW + 3.6, 0.35, 0.35), mat('#2b3768'));
    roofFrame.position.set(0, totalH + 5.6, FD / 2 + 1.6); building.add(roofFrame);
    const roofFrame2 = roofFrame.clone(); roofFrame2.position.z = -FD / 2 - 1.6; building.add(roofFrame2);
    const parapet = box(FW + 3.5, 1.0, 0.3, '#2b3768');
    parapet.position.set(0, totalH + 6.3, FD / 2 + 1.6);
    building.add(parapet);
    const parapet2 = parapet.clone(); parapet2.position.z = -FD / 2 - 1.6; building.add(parapet2);
    const roofGarden = plant(-8, totalH + 5.9, 1.3); building.add(roofGarden);
    const roofGarden2 = plant(8, totalH + 5.9, 1.1); building.add(roofGarden2);

    // Debu/partikel melayang: kesan hidup
    const DUST = 130;
    const dustPos = new Float32Array(DUST * 3);
    const dustSeed = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 70;
      dustPos[i * 3 + 1] = Math.random() * (totalH + 14) - 1;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 55;
      dustSeed[i] = Math.random() * 10;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x8ea2ff, size: 0.28, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    dust.userData.noDim = true;
    scene.add(dust);

    const detailOf = (a: Row) => parseRow({ ...a, current_task: a.current_task || state.current.tasks.find(t => t.id === a.current_task_id) });
    const glbLoader = new GLTFLoader();
    // Placeholder: bayangan + label nama (bukan karakter) — diganti model .glb saat load selesai
    const spawnPlaceholder = (a: Row, ai: number) => {
      let fi = 0, ri = 0, acc = 0;
      const gi = roomOfAgent(a, ai);
      for (let f = 0; f < officeFloors.length; f++) {
        if (gi < acc + officeFloors[f].rooms.length) { fi = f; ri = gi - acc; break; }
        acc += officeFloors[f].rooms.length;
      }
      const cols = 3, cw = FW / cols, rows = Math.ceil(officeFloors[fi].rooms.length / cols), cd = FD / rows;
      const col = ri % cols, row = Math.floor(ri / cols);
      const cx = -FW / 2 + col * cw + cw / 2, cz = -FD / 2 + row * cd + cd / 2;
      const slot = ai % 4;
      const px = cx - 2.8 + (slot % 2) * 2.4, pz = cz - 2.2 + Math.floor(slot / 2) * 2.2;
      const g = new THREE.Group();
      g.userData.agent = a;
      const label = textSprite(String((a as Record<string, unknown>).display_name ?? (a as Record<string, unknown>).name ?? (a as Record<string, unknown>).id ?? `agen-${ai}`).slice(0, 14), charEntry(a, ai).color, 0.45);
      label.position.y = 3.15;
      g.add(label);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; g.add(shadow);
      g.position.set(px, fi * GAP + 0.62, pz);
      g.rotation.y = (ai * 1.3) % (Math.PI * 2);
      floorGroups[fi].add(g);
      const rig: Rig = { g, base: g.position.clone(), phase: ai * 1.7, mixer: new THREE.AnimationMixer(g), clips: new Map(), cur: '', act: null, agent: a, label };
      rigs.push(rig);
      return rig;
    };
    const playClip = (rig: Rig, name: string) => {
      if (rig.cur === name || !rig.clips.has(name)) return;
      const next = rig.mixer.clipAction(rig.clips.get(name)!);
      next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.3).play();
      rig.act?.fadeOut(0.3);
      rig.act = next; rig.cur = name;
    };
    let cancelled = false;
    state.current.agents.forEach((a, ai) => {
      const rig = spawnPlaceholder(a, ai);
      // Model rig dari file .glb — bukan primitif
      glbLoader.loadAsync(charEntry(a, ai).file).then((gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => {
        if (cancelled) return;
        const model = SkeletonUtils.clone(gltf.scene);
        model.traverse((o: THREE.Object3D) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.userData.agent = a; pickables.push(o); } });
        model.userData.agent = a;
        rig.g.add(model);
        for (const c of gltf.animations) rig.clips.set(c.name, c);
        playClip(rig, animFor(a));
      }).catch(() => { /* placeholder bertahan bila file belum ada */ });
    });

    const HELI = { y: 11, r: 56, phi: 1.28, theta: 0.75 };
    const FOCUS_R = 42;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const initF = focusRef.current;
    const target = new THREE.Vector3(0, initF < 0 ? HELI.y : initF * GAP + 2.5, 0);
    const goal = target.clone();
    let goalRadius = initF < 0 ? HELI.r : FOCUS_R;
    let goalPhi = initF < 0 ? HELI.phi : 1.28;
    let lastFocus = initF;
    let lastReset = resetRef.current;
    let theta = HELI.theta, phi = initF < 0 ? HELI.phi : 1.28, radius = goalRadius;
    let auto = !reduced && spinRef.current;
    const applyDim = (ff: number) => {
      floorGroups.forEach((fg2, fi2) => {
        const dim = ff >= 0 && fi2 !== ff;
        // Label ruangan hanya tampil di lantai fokus (tampilan semua: sembunyi agar tidak numpuk); tag lantai selalu tampil
        (roomLabels[fi2] ?? []).forEach(sp => { sp.visible = ff >= 0 && !dim; });
        fg2.traverse(o => {
          if ((o as THREE.Points).isPoints || o.userData.noDim) return;
          if ((o as THREE.Sprite).isSprite && ((roomLabels[fi2] ?? []).includes(o as THREE.Sprite) || floorTags.includes(o as THREE.Sprite))) return;
          const mm = o as THREE.Mesh | THREE.Sprite;
          const material = (mm as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
          if (!material) return;
          const mats = Array.isArray(material) ? material : [material];
          mats.forEach(mt => {
            if (mt === (dust.material as THREE.Material)) return;
            mt.transparent = true;
            mt.opacity = dim ? 0.14 : (mt.userData.baseOpacity ?? 1) as number;
          });
        });
      });
    };
    // Simpan opacity dasar material kaca/cahaya
    scene.traverse(o => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m && !Array.isArray(m)) (m.userData as Record<string, unknown>).baseOpacity = m.opacity;
    });
    applyDim(initF);
    const applyCam = () => {
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.sin(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.cos(theta),
      );
      camera.lookAt(target);
    };
    applyCam();

    let dragging = false, moved = 0, lx = 0, ly = 0, downAt = 0;
    const dom = renderer.domElement;
    dom.style.touchAction = 'none';
    dom.style.display = 'block';
    dom.style.width = '100%';
    dom.style.height = '100%';
    const down = (e: PointerEvent) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; downAt = Date.now(); auto = false; try { dom.setPointerCapture(e.pointerId); } catch { /* abaikan */ } };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      moved += Math.abs(dx) + Math.abs(dy);
      theta -= dx * 0.006;
      phi = Math.min(1.35, Math.max(0.35, phi - dy * 0.004));
      lx = e.clientX; ly = e.clientY;
      applyCam();
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      if (moved < 6 && Date.now() - downAt < 600) {
        const r = dom.getBoundingClientRect();
        const ptr = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ptr, camera);
        const hit = ray.intersectObjects(pickables, false)[0];
        const agent = (hit?.object.userData.agent ?? (hit?.object.userData.pick as THREE.Group | undefined)?.userData.agent) as Row | undefined;
        if (agent) select.current(detailOf(agent));
      }
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); radius = Math.min(110, Math.max(26, radius + e.deltaY * 0.05)); applyCam(); };
    dom.addEventListener('pointerdown', down);
    dom.addEventListener('pointermove', move);
    dom.addEventListener('pointerup', up);
    dom.addEventListener('wheel', wheel, { passive: false });

    const resize = () => {
      const w = el.clientWidth || 800, h = Math.max(380, Math.min(620, w * 0.55));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const weak = small || (navigator.hardwareConcurrency ?? 8) <= 4 || reduced;
    let composer: EffectComposer | null = null;
    let bloom: UnrealBloomPass | null = null;
    if (!weak) {
      try {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        bloom = new UnrealBloomPass(new THREE.Vector2(el.clientWidth || 800, 400), 0.12, 0.4, 1.0);
        composer.addPass(bloom);
        composer.addPass(new OutputPass());
      } catch { composer = null; }
    }
    const renderFrame = () => { if (composer) composer.render(); else renderer.render(scene, camera); };
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      const ff = focusRef.current;
      if (ff !== lastFocus) {
        lastFocus = ff;
        goal.set(0, ff < 0 ? HELI.y : ff * GAP + 2.5, 0);
        goalRadius = ff < 0 ? HELI.r : FOCUS_R;
        goalPhi = ff < 0 ? HELI.phi : 1.28;
        applyDim(ff);
      }
      if (resetRef.current !== lastReset) {
        lastReset = resetRef.current;
        theta = HELI.theta; goalPhi = HELI.phi;
        goal.set(0, HELI.y, 0); goalRadius = HELI.r;
        auto = !reduced && spinRef.current;
      }
      auto = !dragging && !reduced && spinRef.current;
      if (target.distanceToSquared(goal) > 0.0001 || Math.abs(radius - goalRadius) > 0.01 || Math.abs(phi - goalPhi) > 0.001) {
        target.lerp(goal, 0.07);
        radius += (goalRadius - radius) * 0.07;
        phi += (goalPhi - phi) * 0.07;
        applyCam();
      }
      if (auto) { theta += 0.0016; applyCam(); }
      // Agen GLB: AnimationMixer + klip sesuai status (crossfade 0.3s), gerak posisi kecil
      const dt = Math.min(clock.getDelta(), 0.05);
      for (const rig of rigs) {
        rig.mixer.update(dt);
        playClip(rig, animFor(rig.agent));
        const k = reduced ? 0 : 1;
        const wx = Math.sin(t * 0.35 + rig.phase) * 1.1 * k;
        const wz = Math.cos(t * 0.28 + rig.phase) * 0.9 * k;
        rig.g.position.set(rig.base.x + wx, rig.base.y, rig.base.z + wz);
        rig.g.rotation.y += (Math.atan2(wx, wz) - rig.g.rotation.y) * 0.02 * k + (auto ? 0.0004 : 0);
      }
      blinkers.forEach((b, i) => { (b as THREE.Mesh).visible = Math.sin(t * 3 + i * 1.3) > -0.2; });
      // Debu naik perlahan
      const pos = dustGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < DUST; i++) {
        let y = pos.getY(i) + 0.012;
        if (y > totalH + 13) y = -1;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(t * 0.6 + dustSeed[i]) * 0.004);
      }
      pos.needsUpdate = true;
      renderFrame();
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      for (const rig of rigs) { rig.act?.stop(); rig.mixer.stopAllAction(); rig.mixer.uncacheRoot(rig.g); }
      dom.removeEventListener('pointerdown', down);
      dom.removeEventListener('pointermove', move);
      dom.removeEventListener('pointerup', up);
      dom.removeEventListener('wheel', wheel);
      scene.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry) (m.geometry as THREE.BufferGeometry).dispose();
        const material = m.material as THREE.Material | THREE.Material[] | undefined;
        const mats = material ? (Array.isArray(material) ? material : [material]) : [];
        mats.forEach(x => { const s = x as THREE.SpriteMaterial; s.map?.dispose(); x.dispose(); });
      });
      composer?.dispose();
      renderer.dispose();
      el.removeChild(dom);
    };
  }, []);

  useEffect(() => {
    host.current?.setAttribute('data-focus-floor', String(focusFloor));
  }, [focusFloor]);

  return <div ref={host} className="office3d" role="img" aria-label="Kantor virtual 3D — geser untuk putar, scroll untuk zoom, klik agen untuk detail" />;
}
