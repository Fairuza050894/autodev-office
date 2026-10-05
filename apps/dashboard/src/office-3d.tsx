'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { parseRow, type Row } from '@autodev/ui';
import { agentDot, isBusyAgent, officeFloors, roomOfAgent } from './office-data';

function textSprite(text: string, accent = '#a5b4fc'): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(10,15,35,0.82)';
  g.beginPath();
  g.roundRect(4, 20, 504, 88, 18);
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
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(7.2, 1.8, 1);
  return sp;
}

function box(w: number, h: number, d: number, color: string, emissive = 0): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.15, emissive, emissiveIntensity: emissive ? 0.9 : 0 }),
  );
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function deskSet(color = '#6366f1'): THREE.Group {
  const g = new THREE.Group();
  const top = box(3.4, 0.25, 1.7, '#3b4670'); top.position.y = 1.05; g.add(top);
  const leg = box(3.0, 1.0, 1.2, '#232c52'); leg.position.y = 0.5; g.add(leg);
  const mon = box(1.4, 0.9, 0.12, '#0b1020', 0x2233aa); mon.position.set(-0.4, 1.75, -0.3); g.add(mon);
  const chair = box(0.9, 0.9, 0.9, color); chair.position.set(0.3, 0.45, 1.6); g.add(chair);
  return g;
}

function loungeSet(color = '#22d3ee'): THREE.Group {
  const g = new THREE.Group();
  const sofa = box(3.2, 0.8, 1.2, color); sofa.position.y = 0.4; g.add(sofa);
  const back = box(3.2, 0.9, 0.35, color); back.position.set(0, 1.1, -0.55); g.add(back);
  const table = box(1.6, 0.5, 0.9, '#3b4670'); table.position.set(0, 0.25, 1.3); g.add(table);
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
  return g;
}

function gymSet(): THREE.Group {
  const g = new THREE.Group();
  const bench = box(2.6, 0.5, 0.9, '#7c3aed'); bench.position.y = 0.5; g.add(bench);
  const rack = box(0.4, 1.6, 0.9, '#3b4670'); rack.position.set(-1.1, 0.8, 0); g.add(rack);
  const mat = box(1.4, 0.12, 2.6, '#22c55e'); mat.position.set(1.8, 0.06, 0); g.add(mat);
  return g;
}

function pantrySet(): THREE.Group {
  const g = new THREE.Group();
  const counter = box(3.4, 1.0, 1.0, '#b45309'); counter.position.y = 0.5; g.add(counter);
  const table = box(2.2, 0.25, 2.2, '#3b4670'); table.position.set(0, 0.95, 2.2); g.add(table);
  for (const [dx, dz] of [[-1.5, 2.2], [1.5, 2.2], [0, 3.4]] as const) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 12), new THREE.MeshStandardMaterial({ color: '#22d3ee', roughness: 0.6 }));
    stool.position.set(dx, 0.45, dz);
    stool.castShadow = true;
    g.add(stool);
  }
  return g;
}

function furnitureFor(room: string): THREE.Group {
  if (/RECEPTION/.test(room)) { const g = new THREE.Group(); const c = box(4.2, 1.0, 0.9, '#6366f1'); c.position.y = 0.5; g.add(c); const s = loungeSet(); s.position.set(0, 0, 2.6); g.add(s); return g; }
  if (/PM ROOM|RELEASE/.test(room)) { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.25, 20), new THREE.MeshStandardMaterial({ color: '#3b4670', roughness: 0.6 })); t.position.y = 1.0; t.castShadow = true; g.add(t); for (let i = 0; i < 4; i++) { const ch = box(0.7, 0.7, 0.7, '#6366f1'); const a = (i / 4) * Math.PI * 2; ch.position.set(Math.cos(a) * 2.5, 0.35, Math.sin(a) * 2.5); g.add(ch); } return g; }
  if (/SERVER|QA|SECURITY|DEVOPS/.test(room)) return rackSet();
  if (/GYM/.test(room)) return gymSet();
  if (/PANTRY/.test(room)) return pantrySet();
  if (/ROOFTOP|GAME|REST|LIBRARY/.test(room)) { const g = new THREE.Group(); const l = loungeSet(room.includes('GAME') ? '#a78bfa' : '#22d3ee'); g.add(l); const d = deskSet('#f59e0b'); d.position.set(0, 0, -2.6); g.add(d); return g; }
  return deskSet();
}

export default function Office3D({ agents, tasks, onSelect, focusFloor = -1 }: { agents: Row[]; tasks: Row[]; onSelect: (r: Row) => void; focusFloor?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const state = useRef({ agents, tasks, focusFloor });
  state.current = { agents, tasks, focusFloor };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      el.innerHTML = '<p class="muted">WebGL tidak tersedia di perangkat ini — gunakan denah 2D.</p>';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b1020, 90, 220);
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 500);

    scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x1a2040, 0.95));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(30, 55, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x22d3ee, 0.35);
    fill.position.set(-25, 20, -30);
    scene.add(fill);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 48), new THREE.MeshStandardMaterial({ color: 0x0e1530, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.2;
    ground.receiveShadow = true;
    scene.add(ground);

    const building = new THREE.Group();
    scene.add(building);
    const blinkers: THREE.Object3D[] = [];
    const floaters: { g: THREE.Group; base: number; busy: boolean; phase: number }[] = [];
    const pickables: THREE.Object3D[] = [];

    const FW = 32, FD = 22, GAP = 10.5;
    const floorCols = ['#6366f1', '#22d3ee', '#a78bfa'];
    officeFloors.forEach((fl, fi) => {
      const baseY = fi * GAP;
      const slab = box(FW + 2, 0.7, FD + 2, '#1a2350');
      slab.position.y = baseY;
      building.add(slab);
      const cols = 3, cw = FW / cols, rows = Math.ceil(fl.rooms.length / cols), cd = FD / rows;
      fl.rooms.forEach((room, ri) => {
        const occupied = state.current.agents.filter((a, ai) => {
          const flat = fi * 100 + ri;
          void flat;
          return roomOfAgent(a, ai) === officeFloors.slice(0, fi).reduce((n, f) => n + f.rooms.length, 0) + ri;
        });
        const active = occupied.some(isBusyAgent);
        const col = ri % cols, row = Math.floor(ri / cols);
        const cx = -FW / 2 + col * cw + cw / 2, cz = -FD / 2 + row * cd + cd / 2;
        const tile = box(cw - 0.7, 0.25, cd - 0.7, active ? '#2b3a7d' : '#202a5c');
        tile.position.set(cx, baseY + 0.45, cz);
        building.add(tile);
        const wallMat = new THREE.MeshStandardMaterial({ color: active ? 0x6366f1 : 0x39447c, roughness: 0.8, transparent: true, opacity: 0.9 });
        const back = new THREE.Mesh(new THREE.BoxGeometry(cw - 0.7, 2.4, 0.3), wallMat);
        back.position.set(cx, baseY + 1.6, cz - cd / 2 + 0.5);
        back.castShadow = true;
        building.add(back);
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, cd - 0.7), wallMat);
        side.position.set(cx - cw / 2 + 0.5, baseY + 1.6, cz);
        side.castShadow = true;
        building.add(side);
        const furn = furnitureFor(room.name);
        furn.position.set(cx, baseY + 0.55, cz + 0.6);
        building.add(furn);
        furn.traverse(o => { if ((o as THREE.Mesh).userData.blink) blinkers.push(o); });
        const label = textSprite(room.name, active ? '#22d3ee' : floorCols[fi]);
        label.position.set(cx, baseY + 5.6, cz);
        building.add(label);
      });
      const tag = textSprite(fl.name.toUpperCase(), floorCols[fi]);
      tag.position.set(-FW / 2 - 6.5, baseY + 2.4, 0);
      building.add(tag);
    });

    const detailOf = (a: Row) => parseRow({ ...a, current_task: a.current_task || state.current.tasks.find(t => t.id === a.current_task_id) });
    state.current.agents.forEach((a, ai) => {
      let flat = 0, fi = 0, ri = 0, acc = 0;
      const gi = roomOfAgent(a, ai);
      for (let f = 0; f < officeFloors.length; f++) {
        if (gi < acc + officeFloors[f].rooms.length) { fi = f; ri = gi - acc; break; }
        acc += officeFloors[f].rooms.length;
      }
      flat = gi;
      void flat;
      const cols = 3, cw = FW / cols, rows = Math.ceil(officeFloors[fi].rooms.length / cols), cd = FD / rows;
      const col = ri % cols, row = Math.floor(ri / cols);
      const cx = -FW / 2 + col * cw + cw / 2, cz = -FD / 2 + row * cd + cd / 2;
      const slot = ai % 4;
      const px = cx - 2.6 + (slot % 2) * 2.2, pz = cz - 2.4 + Math.floor(slot / 2) * 2.2;
      const g = new THREE.Group();
      const color = agentDot(a);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.9, 4, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
      body.position.y = 1.15;
      body.castShadow = true;
      body.userData.agent = a;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 16), new THREE.MeshStandardMaterial({ color: '#edc8a5', roughness: 0.6 }));
      head.position.y = 2.25;
      head.userData.agent = a;
      g.add(head);
      if (isBusyAgent(a)) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.09, 8, 28), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.12;
        g.add(ring);
      }
      g.position.set(px, fi * GAP + 0.55, pz);
      g.userData.detail = () => detailOf(a);
      body.userData.pick = g;
      head.userData.pick = g;
      pickables.push(body, head);
      building.add(g);
      floaters.push({ g, base: g.position.y, busy: isBusyAgent(a), phase: ai * 0.9 });
    });

    const target = new THREE.Vector3(0, 10, 0);
    let theta = 0.75, phi = 1.02, radius = 58, auto = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    const down = (e: PointerEvent) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; downAt = Date.now(); auto = false; dom.setPointerCapture(e.pointerId); };
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
        const agent = (hit?.object.userData.agent ?? hit?.object.userData.pick?.children[0]?.userData.agent) as Row | undefined;
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
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      if (auto) { theta += 0.0016; applyCam(); }
      for (const f of floaters) if (f.busy) f.g.position.y = f.base + Math.sin(t * 2 + f.phase) * 0.18;
      blinkers.forEach((b, i) => { (b as THREE.Mesh).visible = Math.sin(t * 3 + i) > -0.2; });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener('pointerdown', down);
      dom.removeEventListener('pointermove', move);
      dom.removeEventListener('pointerup', up);
      dom.removeEventListener('wheel', wheel);
      scene.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach(x => { const s = x as THREE.SpriteMaterial; s.map?.dispose(); x.dispose(); });
        else if (mat) { const s = mat as THREE.SpriteMaterial; s.map?.dispose(); mat.dispose(); }
      });
      renderer.dispose();
      el.removeChild(dom);
    };
  }, []);

  useEffect(() => {
    host.current?.setAttribute('data-focus-floor', String(focusFloor));
  }, [focusFloor]);

  return <div ref={host} className="office3d" role="img" aria-label="Kantor virtual 3D — geser untuk putar, scroll untuk zoom, klik agen untuk detail" />;
}
