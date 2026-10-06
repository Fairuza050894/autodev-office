'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, ContactShadows, Html, Sparkles, useGLTF } from '@react-three/drei';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { parseRow, type Row } from '@autodev/ui';
import { isBusyAgent, officeFloors, roomOfAgent } from './office-data';
import { animFor, charEntry } from './character-manifest';

const FW = 36, FD = 24, GAP = 18;
const HELI = { y: 14, r: 132, phi: 0.92, theta: 0.6 };
const floorCols = ['#f59e0b', '#22d3ee', '#c084fc'];
const ROOM_ICON: Record<string,string> = { RECEPTION:'◉', 'PM ROOM':'✦', 'BA & PO':'▤', 'DESIGN STUDIO':'✎', ARCHITECTURE:'⌂', 'DEV FLOOR':'⌨', 'QA LAB':'🧪', SECURITY:'🛡', 'DEVOPS / SERVER':'🖥', 'RELEASE DESK':'🚀', LIBRARY:'📚', PANTRY:'☕', 'GAME ROOM':'🎮', 'REST ROOM':'💤', GYM:'🏋', 'ROOFTOP LOUNGE':'🌙' };
interface NavState { theta: number; phi: number; r: number; gr: number; gp: number; lx: number; ly: number; moved: number }
export const ROOM_SPOTS: Record<string, [number, number, number]> = {
  RECEPTION: [0, 0.6, 0.4], 'PM ROOM': [0, 0.6, -1.2], 'BA & PO': [1.5, 0.6, 0.5],
  'DESIGN STUDIO': [-1.5, 0.6, 0.5], ARCHITECTURE: [0, 0.6, -0.5], 'DEV FLOOR': [-1.2, 0.6, 0.8],
  'QA LAB': [1.2, 0.6, -0.8], SECURITY: [0, 0.6, 0.5], 'DEVOPS / SERVER': [-1.5, 0.6, -1],
  'RELEASE DESK': [1.5, 0.6, 0.8], LIBRARY: [0, 0.6, 1.5], PANTRY: [0.5, 0.6, 1],
  'GAME ROOM': [-1, 0.6, 0.5], 'REST ROOM': [1, 0.6, 0.5], GYM: [0, 0.6, 0],
  'ROOFTOP LOUNGE': [0, 0.6, 0],
};
function slotPos(room: string, ai: number): [number, number, number] {
  const base = ROOM_SPOTS[room] ?? [0, 0.6, 0];
  const s = ai % 4;
  return [base[0] - 1.6 + (s % 2) * 2.2, base[1], base[2] - 1 + Math.floor(s / 2) * 1.8];
}

// Monitor: layar emissive + log nyata (Html) + cursor blink + scroll
function DeskMonitor({ log, accent = '#8ea2ff', showLog = true }: { log: string; accent?: string; showLog?: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick(v => v + 1), 1200); return () => clearInterval(t); }, []);
  const lines = useMemo(() => {
    const ls = log.split('\n').filter(Boolean).slice(-5);
    return ls.length ? ls : ['standby — menunggu tugas'];
  }, [log]);
  const shown = lines.slice(0, 3 + (tick % 3));
  return (
    <group>
      <mesh position={[-0.4, 1.75, -0.3]} castShadow>
        <boxGeometry args={[1.4, 0.9, 0.1]} />
        <meshStandardMaterial color="#0b1020" emissive={0x2a3fd4} emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[-0.4, 1.75, -0.24]}>
        <planeGeometry args={[1.2, 0.7]} />
        <meshBasicMaterial color={accent} transparent opacity={0.55} />
      </mesh>
      {showLog && <Html position={[-0.4, 1.78, -0.22]} transform occlude="blending" distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div style={{ width: 150, fontSize: 9, fontFamily: 'monospace', color: '#c7d2fe', background: 'rgba(5,8,20,.78)', padding: '4px 6px', borderRadius: 4, lineHeight: 1.35 }}>
          {shown.map((l, i) => <div key={i} style={{ opacity: 0.45 + (0.55 * (i + 1)) / shown.length, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.slice(0, 26)}</div>)}
          <span style={{ animation: 'blink 1s steps(2) infinite' }}>▊</span>
        </div>
      </Html>}
    </group>
  );
}

// Furniture nyata per ruangan (JSX, tanpa helper box()/mat() lama)
function Desk({ color = '#46538c', log = '', accent, showLog = true }: { color?: string; log?: string; accent?: string; showLog?: boolean }) {
  return (
    <group>
      <mesh position={[0, 1.05, 0]} castShadow receiveShadow><boxGeometry args={[3.4, 0.22, 1.7]} /><meshStandardMaterial color="#46538c" roughness={0.65} /></mesh>
      {[[-1.5], [1.5]].map(([x]) => <mesh key={x} position={[x, 0.5, 0]} castShadow><boxGeometry args={[0.18, 1.0, 1.4]} /><meshStandardMaterial color="#232c52" roughness={0.7} /></mesh>)}
      <DeskMonitor log={log} accent={accent} showLog={showLog} />
      <mesh position={[-0.4, 1.2, 0.5]}><boxGeometry args={[1.1, 0.08, 0.4]} /><meshStandardMaterial color="#1b2450" /></mesh>
      <mesh position={[0.3, 0.5, 1.7]} castShadow><boxGeometry args={[0.9, 0.55, 0.9]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>
      <mesh position={[0.3, 1.1, 2.05]} castShadow><boxGeometry args={[0.9, 0.8, 0.18]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>
    </group>
  );
}
function Furniture({ room, log, accent, showLog = true }: { room: string; log: string; accent: string; showLog?: boolean }) {
  if (/RECEPTION/.test(room)) return <group><mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[4.2, 1.0, 0.9]} /><meshStandardMaterial color="#6366f1" /></mesh><group position={[0, 0, 2.8]}><mesh position={[0, 0.35, 0]} castShadow><boxGeometry args={[3.2, 0.7, 1.2]} /><meshStandardMaterial color="#22d3ee" /></mesh></group></group>;
  if (/PM ROOM|RELEASE/.test(room)) return <group><mesh position={[0, 1, 0]} castShadow receiveShadow><cylinderGeometry args={[1.7, 1.7, 0.22, 20]} /><meshStandardMaterial color="#8b98c4" /></mesh><mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.25, 0.35, 1, 10]} /><meshStandardMaterial color="#232c52" /></mesh>{[0, 1, 2, 3].map(i => { const a = (i / 4) * Math.PI * 2; return <mesh key={i} position={[Math.cos(a) * 2.6, 0.37, Math.sin(a) * 2.6]} castShadow><boxGeometry args={[0.7, 0.75, 0.7]} /><meshStandardMaterial color="#6366f1" /></mesh>; })}<mesh position={[0, 2.2, -2.9]}><boxGeometry args={[2.4, 1.3, 0.1]} /><meshStandardMaterial color="#e8ddc8" emissive={0x445566} emissiveIntensity={0.5} /></mesh></group>;
  if (/SERVER|QA|SECURITY|DEVOPS/.test(room)) return <group>{[0, 1].map(i => <group key={i} position={[i * 1.6 - 0.8, 0, 0]}><mesh position={[0, 1.6, 0]} castShadow><boxGeometry args={[1.2, 3.2, 1]} /><meshStandardMaterial color="#1b2450" emissive={0x113366} emissiveIntensity={0.8} /></mesh>{[0, 1, 2, 3].map(l => <mesh key={l} position={[0, 0.7 + l * 0.7, 0.55]}><sphereGeometry args={[0.09, 8, 8]} /><meshBasicMaterial color={l % 2 ? '#22c55e' : '#22d3ee'} /></mesh>)}</group>)}<mesh position={[0, 0.45, 1.8]}><boxGeometry args={[1.8, 0.9, 0.7]} /><meshStandardMaterial color="#46538c" /></mesh><mesh position={[0, 1.3, 1.7]}><boxGeometry args={[1.5, 0.7, 0.08]} /><meshStandardMaterial color="#0b1020" emissive={0x22d3ee} emissiveIntensity={0.9} /></mesh></group>;
  if (/GYM/.test(room)) return <group><mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[2.6, 0.45, 0.9]} /><meshStandardMaterial color="#7c3aed" /></mesh><mesh position={[1.8, 0.05, 0]}><boxGeometry args={[1.4, 0.1, 2.6]} /><meshStandardMaterial color="#22c55e" /></mesh>{[0, 1, 2].map(i => <mesh key={i} position={[-1.1, 0.5 + i * 0.35, 0.55]} castShadow><cylinderGeometry args={[0.35, 0.35, 0.12, 14]} /><meshStandardMaterial color={i ? '#f59e0b' : '#6366f1'} /></mesh>)}</group>;
  if (/PANTRY/.test(room)) return <group><mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[3.4, 1, 1]} /><meshStandardMaterial color="#8a5a2b" /></mesh><mesh position={[0, 1.05, 0]}><boxGeometry args={[3.6, 0.12, 1.2]} /><meshStandardMaterial color="#e8ddc8" /></mesh></group>;
  if (/BA & PO|DESIGN|ARCHITECTURE/.test(room)) return <group><Desk log={log} accent={accent} showLog={showLog} /><group position={[0, 0, -3.4]} rotation-y={Math.PI}><Desk color="#a78bfa" log={log} accent={accent} showLog={showLog} /></group><mesh position={[-3.4, 2.1, -0.6]} rotation-y={Math.PI / 2}><boxGeometry args={[2.6, 1.4, 0.1]} /><meshStandardMaterial color="#e8ddc8" emissive={0x334455} emissiveIntensity={0.5} /></mesh></group>;
  return <group><Desk log={log} accent={accent} showLog={showLog} /><group position={[0, 0, -3.2]} rotation-y={Math.PI}><Desk color="#22d3ee" log={log} accent={accent} showLog={showLog} /></group></group>;
}

// Agen GLB rig — useGLTF + useAnimations, crossfade 0.3s, klip dari status
function Agent({ a, ai, pos, showLabel = true, nav, onSelect, focusAll = false }: { a: Row; ai: number; pos: [number, number, number]; showLabel?: boolean; nav: React.MutableRefObject<NavState>; onSelect: (r: Row) => void; focusAll?: boolean }) {
  const entry = charEntry(a, ai);
  const { scene, animations } = useGLTF(entry.file);
  const ref = useRef<THREE.Group>(null);
  const cur = useRef<{ name: string; act: THREE.AnimationAction | null }>({ name: '', act: null });
  const clip = animFor(a);
  const model = useMemo(() => {
    const m = SkeletonUtils.clone(scene);
    m.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.userData.agent = a; } });
    return m;
  }, [scene, a]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  useEffect(() => {
    const found = animations.find(c => c.name === clip) ?? animations[0];
    if (!found || cur.current.name === found.name) return;
    const next = mixer.clipAction(found);
    next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.3).play();
    cur.current.act?.fadeOut(0.3);
    cur.current = { name: found.name, act: next };
    return () => { mixer.stopAllAction(); };
  }, [clip, animations]);
  const busy = isBusyAgent(a);
  const breathe = useRef(0);
  useFrame((st, dt) => {
    mixer.update(Math.min(dt, 0.05));
    if (!ref.current) return;
    const t = st.clock.elapsedTime;
    ref.current.position.set(pos[0] + Math.sin(t * 0.35 + ai) * 0.5, pos[1], pos[2] + Math.cos(t * 0.28 + ai) * 0.4);
    if (!busy) { breathe.current += dt; ref.current.scale.setScalar(1 + Math.sin(breathe.current * 1.8 + ai) * 0.012); }
    else ref.current.scale.setScalar(1);
  });
  const raw = String((a as Record<string, unknown>).display_name ?? (a as Record<string, unknown>).name ?? (a as Record<string, unknown>).id ?? `agen-${ai}`);
  const name = raw.replace(' — ', ' · ').replace(' - ', ' · ').slice(0, 26);
  const st = String((a as Record<string, unknown>).status ?? '').toLowerCase();
  const ring = st === 'working' || st === 'running' || Boolean((a as Record<string, unknown>).current_task_id) ? '#6366f1' : st === 'blocked' || st === 'failed' ? '#f59e0b' : '#22c55e';
  return (
    <group ref={ref} position={pos} rotation-y={(ai * 1.3) % (Math.PI * 2)} userData={{ agent: a }} onClick={e => { e.stopPropagation(); if (nav.current.moved > 6) return; onSelect(a); }}>
      <primitive object={model} scale={2.2} />
{showLabel && (!focusAll || busy) && <Billboard position={[0, 6.0, 0]}>
        <Html center zIndexRange={[60, 0]} occlude="raycast" style={{ pointerEvents: 'none' }}>
          <div style={{ fontSize: focusAll ? 12 : 13, fontWeight: 700, color: '#fff', background: 'rgba(10,15,35,.88)', border: `2px solid ${entry.color}`, borderRadius: 12, padding: '3px 10px', whiteSpace: 'nowrap', boxShadow: '0 2px 12px #0008' }}>{focusAll ? name.split(' · ')[0] : name}</div>
        </Html>
      </Billboard>}
      <mesh rotation-x={-Math.PI / 2} position-y={0.08}><torusGeometry args={[1.1, 0.1, 8, 32]} /><meshBasicMaterial color={ring} transparent opacity={0.95} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}><circleGeometry args={[0.7, 20]} /><meshBasicMaterial color={0x000000} transparent opacity={0.3} /></mesh>
    </group>
  );
}

// Partikel handoff: paket dokumen (titik cahaya) melayang antar agen yang sedang bekerja
// Rute lintas lantai lewat tangga V depan agar perpindahan antar lantai masuk akal
function HandoffPaths({ agents }: { agents: Row[] }) {
  const busy = agents.map((a, ai) => ({ a, ai })).filter(({ a }) => isBusyAgent(a)).slice(0, 8);
  const paths = useMemo(() => {
    const out: { pts: THREE.Vector3[]; curve: THREE.CatmullRomCurve3 }[] = [];
    for (let i = 0; i + 1 < busy.length; i += 2) {
      const p1 = agentWorldPos(busy[i].a, busy[i].ai), p2 = agentWorldPos(busy[i + 1].a, busy[i + 1].ai);
      const same = Math.abs(p1.y - p2.y) < 1;
      const mid = same
        ? p1.clone().add(p2).multiplyScalar(0.5).add(new THREE.Vector3(0, 3, 0))
        : new THREE.Vector3(0, Math.min(p1.y, p2.y) + GAP / 2, FD / 2 + 2).add(new THREE.Vector3(0, 2.5, 0));
      out.push({ pts: [p1, mid, p2], curve: new THREE.CatmullRomCurve3([p1, mid, p2]) });
    }
    return out;
  }, [agents.map(a => String(a.id) + String(a.status)).join(',')]);
  const dots = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(st => {
    const t = st.clock.elapsedTime;
    paths.forEach((p, i) => {
      const m = dots.current[i];
      if (!m) return;
      m.position.copy(p.curve.getPoint((t * 0.15 + i * 0.33) % 1));
    });
  });
  return (
    <group>
      {paths.map((p, i) => { const g = new THREE.BufferGeometry().setFromPoints(p.curve.getPoints(24)); return <lineSegments key={i} geometry={g}><lineBasicMaterial color="#22d3ee" transparent opacity={0.5} /></lineSegments>; })}
      {paths.map((p, i) => <mesh key={`d${i}`} ref={el => { dots.current[i] = el; }}><sphereGeometry args={[0.22, 10, 10]} /><meshBasicMaterial color="#e8ddc8" /></mesh>)}
    </group>
  );
}
function agentWorldPos(a: Row, ai: number): THREE.Vector3 {
  let acc = 0, fi = 0, ri = 0;
  const gi = roomOfAgent(a, ai);
  for (let f = 0; f < officeFloors.length; f++) {
    if (gi < acc + officeFloors[f].rooms.length) { fi = f; ri = gi - acc; break; }
    acc += officeFloors[f].rooms.length;
  }
  const cols = 3, cw = FW / cols, rows = Math.ceil(officeFloors[fi].rooms.length / cols), cd = FD / rows;
  const cx = -FW / 2 + (ri % cols) * cw + cw / 2, cz = -FD / 2 + Math.floor(ri / cols) * cd + cd / 2;
  const fl = officeFloors[fi].rooms[ri];
  const [lx, , lz] = slotPos(fl?.name ?? '', ai);
  return new THREE.Vector3(cx + lx, fi * GAP + 2, cz + lz);
}

// Satu ruangan: slab + furniture + papan nama + agen; hover menyala + ringkasan
function Room({ room, cx, cz, cw, cd, fi, occ, log, dim, focusAll, nav, onSelect }: { room: { name: string }; cx: number; cz: number; cw: number; cd: number; fi: number; occ: { a: Row; ai: number }[]; log: string; dim: boolean; focusAll: boolean; nav: React.MutableRefObject<NavState>; onSelect: (r: Row) => void }) {
  const [hover, setHover] = useState(false);
  const active = occ.some(({ a }) => isBusyAgent(a));
  return (
    <group position={[cx, 0.5, cz]} onPointerOver={e => { e.stopPropagation(); setHover(true); }} onPointerOut={() => setHover(false)}>
      <mesh position-y={0} receiveShadow><boxGeometry args={[cw - 0.7, 0.25, cd - 0.7]} /><meshStandardMaterial color={hover ? '#3d4ea8' : active ? '#2c3c82' : '#202a5c'} emissive={hover ? 0x2a3fd4 : active ? 0x1a2a88 : 0} emissiveIntensity={hover ? 1.1 : active ? 0.85 : 0} transparent={dim} opacity={dim ? 0.14 : 1} /></mesh>
      <mesh position={[0, 1.2, -cd / 2 + 0.5]} castShadow><boxGeometry args={[cw - 0.7, 2.5, 0.28]} /><meshStandardMaterial color={active ? 0x6d7bff : 0x39447c} roughness={0.75} transparent opacity={dim ? 0.3 : 0.92} /></mesh>
      <mesh position={[-cw / 2 + 0.5, 1.2, 0]} castShadow><boxGeometry args={[0.28, 2.5, cd - 0.7]} /><meshStandardMaterial color={active ? 0x6d7bff : 0x39447c} roughness={0.75} transparent opacity={dim ? 0.3 : 0.92} /></mesh>
      <mesh position={[0, 1.0, cd / 2 - 0.5]}><boxGeometry args={[cw - 0.7, 1.9, 0.12]} /><meshStandardMaterial color={0x93c5fd} roughness={0.15} metalness={0.4} transparent opacity={dim ? 0.1 : 0.22} /></mesh>
      <group position={[0, 0.1, 0.4]}><Furniture room={room.name} log={log} accent={floorCols[fi]} showLog={!focusAll} /></group>
      {(hover || !focusAll) && <Billboard position={[0, 2.6, 0]}>
        <Html center zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: active ? '#fff7ed' : '#eef1ff', background: 'rgba(10,15,35,.88)', border: `1.5px solid ${active ? '#fdba74' : floorCols[fi]}`, borderRadius: 8, padding: '2px 7px', whiteSpace: 'nowrap', boxShadow: '0 2px 12px #0008' }}>{`${ROOM_ICON[room.name] ?? '▦'} ${room.name}${hover && occ.length ? ` · ${occ.length} agen` : ''}`}</div>
        </Html>
      </Billboard>}
      {occ.map(({ a, ai }, k) => { const spots: [number, number, number][] = [[-1.5, 0.62, -1], [1.5, 0.62, -1], [-1.5, 0.62, 1.2], [1.5, 0.62, 1.2]]; const [lx, ly, lz] = spots[k % spots.length]; return <Agent key={String(a.id)} a={a} ai={ai} pos={[lx, ly, lz]} showLabel={hover || !focusAll} nav={nav} onSelect={onSelect} focusAll={focusAll} />; })}
    </group>
  );
}

// Satu lantai: slab + ruangan + agen
function Floor({ fi, agents, logs, onSelect, dim, focusAll, nav }: { fi: number; agents: { a: Row; ai: number }[]; logs: Map<string, string>; onSelect: (r: Row) => void; dim: boolean; focusAll: boolean; nav: React.MutableRefObject<NavState> }) {
  const fl = officeFloors[fi];
  const baseY = fi * GAP;
  const cols = 3, cw = FW / cols, rows = Math.ceil(fl.rooms.length / cols), cd = FD / rows;
  return (
    <group position-y={baseY}>
      <mesh position-y={0} receiveShadow><boxGeometry args={[FW + 2.5, 0.7, FD + 2.5]} /><meshStandardMaterial color="#1a2350" roughness={0.65} transparent={dim} opacity={dim ? 0.3 : 1} /></mesh>
      <mesh position-y={0.42}><boxGeometry args={[FW + 2.6, 0.14, FD + 2.6]} /><meshStandardMaterial color="#1a2350" emissive={floorCols[fi]} emissiveIntensity={0.12} roughness={0.6} transparent={dim} opacity={dim ? 0.3 : 1} /></mesh>
      {[[0, FD / 2 + 1.2, FW + 2.6, 0.3], [0, -FD / 2 - 1.2, FW + 2.6, 0.3]].map(([x, z, w, d], i) => <mesh key={`ex${i}`} position={[x, 0.5, z]}><boxGeometry args={[w, 0.22, d]} /><meshStandardMaterial color={floorCols[fi]} emissive={floorCols[fi]} emissiveIntensity={0.9} roughness={0.5} transparent={dim} opacity={dim ? 0.3 : 1} /></mesh>)}
      {[[FW / 2 + 1.2, 0], [-FW / 2 - 1.2, 0]].map(([x, z], i) => <mesh key={`ez${i}`} position={[x, 0.5, z]}><boxGeometry args={[0.3, 0.22, FD + 2.6]} /><meshStandardMaterial color={floorCols[fi]} emissive={floorCols[fi]} emissiveIntensity={0.9} roughness={0.5} transparent={dim} opacity={dim ? 0.3 : 1} /></mesh>)}
      {((fi === 2 && focusAll) || fi !== 2) && <mesh position-y={4.2} receiveShadow><boxGeometry args={[FW + 1, 0.4, FD + 1]} /><meshStandardMaterial color={fi === 2 ? '#3b4670' : '#1a2350'} roughness={0.7} transparent opacity={fi === 2 ? 0.25 : 1} /></mesh>}
      {fi === 2 && <group>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <mesh key={`rr${sx}${sz}`} position={[sx * (FW / 2 - 0.5), 5.4, sz * (FD / 2 - 0.5)]}><boxGeometry args={[0.25, 1.8, 0.25]} /><meshStandardMaterial color="#4a5688" roughness={0.6} /></mesh>)}
        {[0, 1, 2, 3].map(i => <mesh key={`rl${i}`} position={i < 2 ? [0, 6.2, (i ? 1 : -1) * (FD / 2 - 0.5)] : [(i % 2 ? 1 : -1) * (FW / 2 - 0.5), 6.2, 0]} rotation-y={i < 2 ? 0 : Math.PI / 2}><boxGeometry args={[FW - 1, 0.12, 0.12]} /><meshStandardMaterial color="#c084fc" emissive={0xc084fc} emissiveIntensity={0.8} /></mesh>)}
        <mesh position={[0, 6.4, 0]}><boxGeometry args={[FW * 0.5, 0.15, FD * 0.4]} /><meshStandardMaterial color={0x93c5fd} roughness={0.1} metalness={0.3} transparent opacity={0.3} /></mesh>
        <pointLight position={[0, 5.5, 0]} color="#e9d5ff" intensity={4} distance={18} decay={1.8} />
      </group>}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => <mesh key={`${sx}${sz}`} position={[sx * (FW / 2 + 0.6), 1.8, sz * (FD / 2 + 0.6)]} castShadow><cylinderGeometry args={[0.3, 0.35, 3.2, 10]} /><meshStandardMaterial color="#2b3768" /></mesh>)}
      <pointLight position={[0, 6.5, 0]} color="#fff2df" intensity={7} distance={26} decay={1.8} />
      {fl.rooms.map((room, ri) => {
        const col = ri % cols, row = Math.floor(ri / cols);
        const cx = -FW / 2 + col * cw + cw / 2, cz = -FD / 2 + row * cd + cd / 2;
        const start = officeFloors.slice(0, fi).reduce((n, f) => n + f.rooms.length, 0);
        const occ = agents.filter(({ a, ai }) => roomOfAgent(a, ai) - start === ri);
        const log = occ.map(({ a }) => logs.get(String(a.id)) ?? '').filter(Boolean).join('\n');
        return <Room key={room.name} room={room} cx={cx} cz={cz} cw={cw} cd={cd} fi={fi} occ={occ} log={log} dim={dim} focusAll={focusAll} nav={nav} onSelect={onSelect} />;
      })}
      {focusAll && <Billboard position={[FW / 2 + 6.5, 3.2 + fi * 0.4, FD / 2 - 4 + fi]}>
        <Html center zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#eef1ff', background: 'rgba(10,15,35,.82)', border: `2px solid ${floorCols[fi]}`, borderRadius: 9, padding: '3px 10px', whiteSpace: 'nowrap' }}>{fl.name.toUpperCase()}</div>
        </Html>
      </Billboard>}
      {focusAll && <Billboard position={[-FW / 2 - 4.5, 2.2, 0]}>
        <Html center zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: floorCols[fi], background: 'rgba(10,15,35,.85)', border: `3px solid ${floorCols[fi]}`, borderRadius: 14, boxShadow: '0 2px 16px #0009' }}>{fi + 1}</div>
        </Html>
      </Billboard>}
    </group>
  );
}

// Tangga V: dua lajur kiri-kanan ketemu balkon tengah depan, naik ke lantai atas
function Stairs({ fromY, toY, side }: { fromY: number; toY: number; x?: number; z?: number; flip?: boolean; side: -1 | 1 }) {
  const steps = 10;
  const sx = side * (FW / 2 + 1);
  return (
    <group>
      {Array.from({ length: steps }, (_, i) => {
        const t = (i + 0.5) / steps;
        return <mesh key={i} position={[sx + (0 - sx) * t, fromY + 1 + (toY - fromY) * t, FD / 2 + 2]} castShadow><boxGeometry args={[2.2, 0.3, 1.2]} /><meshStandardMaterial color="#4a5688" roughness={0.7} /></mesh>;
      })}
    </group>
  );
}
// Balkon tengah tempat dua lajur V bertemu — pijakan masuk lantai atas
function VBalkon({ y }: { y: number }) {
  return (
    <group>
      <mesh position={[0, y + 0.1, FD / 2 + 2]} receiveShadow><boxGeometry args={[5.5, 0.3, 3.2]} /><meshStandardMaterial color="#33406f" roughness={0.7} /></mesh>
      <mesh position={[0, y + 0.8, FD / 2 + 3.5]}><boxGeometry args={[5.5, 0.15, 0.15]} /><meshStandardMaterial color="#f59e0b" emissive={0xf59e0b} emissiveIntensity={0.6} /></mesh>
    </group>
  );
}

// Backdrop kota (M): blok tetangga + jalan + pohon, boks mati tanpa interaksi
function CityBackdrop() {
  const blocks = useMemo(() => [
    { x: -70, z: -48, w: 14, h: 16, d: 12, c: '#2b3768' }, { x: -78, z: -14, w: 12, h: 10, d: 10, c: '#33406f' },
    { x: 70, z: -44, w: 15, h: 18, d: 12, c: '#2b3768' }, { x: 78, z: -12, w: 11, h: 10, d: 10, c: '#33406f' },
    { x: -38, z: -58, w: 12, h: 14, d: 10, c: '#2e3a68' }, { x: 0, z: -64, w: 16, h: 20, d: 12, c: '#2b3768' },
    { x: 38, z: -58, w: 12, h: 12, d: 10, c: '#33406f' }, { x: -52, z: -56, w: 13, h: 12, d: 10, c: '#2e3a68' },
    { x: 52, z: -56, w: 14, h: 14, d: 11, c: '#2b3768' },
  ], []);
  const trees = useMemo(() => [[-72, -20], [-70, 8], [72, -18], [70, 10], [-60, -44], [58, -44], [-30, -48], [30, -48]], []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-1.45} receiveShadow><boxGeometry args={[220, 160]} /><meshStandardMaterial color="#1c2450" roughness={0.95} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.35, 30]}><planeGeometry args={[200, 8]} /><meshStandardMaterial color="#3f4c80" roughness={0.85} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.35, -32]}><planeGeometry args={[200, 8]} /><meshStandardMaterial color="#3f4c80" roughness={0.85} /></mesh>
      {blocks.map((b, i) => <group key={i} position={[b.x, 0, b.z]}>
        <mesh position-y={b.h / 2 - 1.3} castShadow><boxGeometry args={[b.w, b.h, b.d]} /><meshStandardMaterial color={b.c} roughness={0.8} /></mesh>
        {[-1, 0, 1].map(r => <mesh key={r} position={[0, b.h / 2 + r * 3 - 1.3, b.d / 2 + 0.06]}><boxGeometry args={[b.w * 0.7, 1.1, 0.08]} /><meshStandardMaterial color="#0b1020" emissive={0xfbbf24} emissiveIntensity={0.7} /></mesh>)}
      </group>)}
      {trees.map(([x, z], i) => <group key={i} position={[x, 0, z]}>
        <mesh position-y={-0.3} castShadow><cylinderGeometry args={[0.18, 0.24, 1.6, 8]} /><meshStandardMaterial color="#5b4226" /></mesh>
        <mesh position-y={1.1}><sphereGeometry args={[1.1, 10, 10]} /><meshStandardMaterial color="#22c55e" roughness={0.8} /></mesh>
      </group>)}
    </group>
  );
}

// Lift animasi antar lantai — kabin naik-turun perlahan agar perpindahan agen masuk akal
function Lift() {
  const ref = useRef<THREE.Mesh>(null);
  const lx = FW / 2 + 2.5, lz = -FD / 2 + 1;
  useFrame(st => {
    const t = st.clock.elapsedTime * 0.12 % 1;
    const y = t < 0.5 ? t * 2 * GAP * 2 : (1 - (t - 0.5) * 2) * GAP * 2;
    ref.current?.position.set(lx, y + 1.2, lz);
  });
  return (
    <group>
      {[0, 1].map(g => <mesh key={g} position={[lx, g * GAP + GAP / 2, lz]}><boxGeometry args={[2, GAP, 2]} /><meshStandardMaterial color="#2b3768" transparent opacity={0.3} roughness={0.2} metalness={0.3} /></mesh>)}
      <mesh ref={ref}><boxGeometry args={[1.4, 1.8, 1.4]} /><meshStandardMaterial color="#f59e0b" emissive={0xf59e0b} emissiveIntensity={0.5} roughness={0.4} /></mesh>
    </group>
  );
}

// Konfeti 3D saat proyek delivered — kotak warna-warni jatuh berputar, loop 6 detik
function Confetti3D({ on }: { on: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const cols = useMemo(() => ['#6366f1', '#22d3ee', '#22c55e', '#f59e0b', '#f0abfc'], []);
  const parts = useMemo(() => Array.from({ length: 90 }, (_, i) => ({ x: (i * 37 % 60) - 30, z: (i * 53 % 40) - 20, d: 1.5 + (i % 5) * 0.4, r: (i % 7) * 0.9, c: cols[i % cols.length] })), [cols]);
  useFrame(st => {
    if (!ref.current || !on) return;
    const t = st.clock.elapsedTime;
    ref.current.children.forEach((m, i) => {
      const p = parts[i];
      m.position.set(p.x + Math.sin(t * 0.8 + i) * 1.2, 26 - ((t * p.d + i * 2.2) % 28), p.z);
      m.rotation.set(t * p.r, t * p.r * 0.7, 0);
    });
  });
  if (!on) return null;
  return <group ref={ref}>{parts.map((p, i) => <mesh key={i}><boxGeometry args={[0.35, 0.35, 0.08]} /><meshBasicMaterial color={p.c} /></mesh>)}</group>;
}

// Kontrol kamera: fokus lantai + reset + putar otomatis + ikuti agen
function CamRig({ focus, resetToken, spin, dragging, nav, follow }: { focus: number; resetToken: number; spin: boolean; dragging: React.MutableRefObject<boolean>; nav: React.MutableRefObject<NavState>; follow?: THREE.Vector3 | null }) {
  const { camera } = useThree();
  const st = useRef({ tx: new THREE.Vector3(0, GAP, 0), lastF: -99, lastR: -1, lastFol: '' });
  useEffect(() => { st.current.lastF = -99; }, [focus]);
  useFrame((_, dt) => {
    const s = st.current, n = nav.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fk = follow ? `${follow.x.toFixed(1)},${follow.y.toFixed(1)},${follow.z.toFixed(1)}` : '';
    if (follow) {
      s.lastF = 998; s.tx.lerp(follow, Math.min(1, dt * 3));
      if (fk !== s.lastFol) s.lastFol = fk;
    } else if (focus !== s.lastF) {
      s.lastF = focus;
      s.tx.set(0, focus < 0 ? GAP : focus * GAP + 2.5, 0);
    }
    n.gr = follow ? 28 : focus < 0 ? HELI.r : 58; n.gp = follow ? 1.05 : focus < 0 ? HELI.phi : 1.02;
    n.r += (n.gr - n.r) * Math.min(1, dt * 4);
    n.phi += (n.gp - n.phi) * Math.min(1, dt * 4);
    if (resetToken !== s.lastR) { s.lastR = resetToken; n.theta = HELI.theta; n.gr = n.r = HELI.r; n.gp = n.phi = HELI.phi; s.tx.set(0, HELI.y, 0); }
    if (spin && !reduced && !dragging.current) n.theta += dt * 0.1;
    camera.position.set(s.tx.x + n.r * Math.sin(n.phi) * Math.sin(n.theta), s.tx.y + n.r * Math.cos(n.phi), s.tx.z + n.r * Math.sin(n.phi) * Math.cos(n.theta));
    camera.lookAt(s.tx);
  });
  return null;
}

export default function Office3D({ agents, tasks, onSelect, focusFloor = -1, resetToken = 0, spin = true, followId = null, celebrate = false, night }: { agents: Row[]; tasks: Row[]; onSelect: (r: Row) => void; focusFloor?: number; resetToken?: number; spin?: boolean; followId?: string | null; celebrate?: boolean; night?: boolean }) {
  const dragging = useRef(false);
  const nav = useRef<NavState>({ theta: HELI.theta, phi: HELI.phi, r: HELI.r, gr: HELI.r, gp: HELI.phi, lx: 0, ly: 0, moved: 0 });
  const [webgl, setWebgl] = useState(true);
  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      if (!(c.getContext('webgl2') || c.getContext('webgl'))) setWebgl(false);
    } catch { setWebgl(false); }
  }, []);
  const logs = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) {
      const id = String((t as Record<string, unknown>).assignee_agent ?? '');
      if (!id) continue;
      const line = `${String(t.stage ?? '').slice(0, 10)} ${String(t.title ?? '').slice(0, 30)} [${t.status}]`;
      m.set(id, [line, m.get(id) ?? ''].filter(Boolean).join('\n').split('\n').slice(-6).join('\n'));
    }
    return m;
  }, [tasks]);
  const byFloor = useMemo(() => officeFloors.map((_, fi) => agents.map((a, ai) => ({ a, ai })).filter(({ a, ai }) => {
    let acc = 0; for (let f = 0; f < officeFloors.length; f++) { const r = roomOfAgent(a, ai); if (r >= acc && r < acc + officeFloors[f].rooms.length) return f === fi; acc += officeFloors[f].rooms.length; } return false;
  })), [agents]);
  const detail = (a: Row) => parseRow({ ...a, current_task: a.current_task || tasks.find(t => t.id === a.current_task_id) });
  const small = typeof window !== 'undefined' && window.innerWidth < 720;
  const weak = small || (typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 4);
  const nightMode = night ?? (() => { const h = new Date().getHours(); return h < 6 || h >= 18; })();
  const followPos = useMemo(() => {
    if (!followId) return null;
    const ai = agents.findIndex(a => String(a.id) === followId);
    if (ai < 0) return null;
    return agentWorldPos(agents[ai], ai);
  }, [followId, agents.map(a => `${a.id}:${a.status}:${(a as { current_task_id?: string }).current_task_id ?? ''}`).join(',')]);
  // ponytail: auto-quality + fallback 2D sudah ada di bawah; instancing/LOD karakter jauh = upgrade saat >40 agen
  if (!webgl) return <p className="muted">WebGL tidak tersedia di perangkat ini — gunakan denah 2D.</p>;
  return (
    <div className="office3d" role="img" aria-label="Kantor virtual 3D — geser untuk putar, scroll untuk zoom, klik agen untuk detail" style={{ height: 680 }} onPointerMove={e => { if (!dragging.current) return; const n = nav.current; n.moved += Math.abs(e.clientX - n.lx) + Math.abs(e.clientY - n.ly); n.theta -= (e.clientX - n.lx) * 0.005; n.phi = Math.min(1.25, Math.max(0.35, n.phi - (e.clientY - n.ly) * 0.004)); n.gp = n.phi; n.lx = e.clientX; n.ly = e.clientY; }} onPointerLeave={() => { dragging.current = false; }} onWheel={e => { const n = nav.current; n.r = n.gr = Math.min(220, Math.max(30, n.r + e.deltaY * 0.08)); }}>
      <Canvas shadows dpr={weak ? 1 : [1, 2]} camera={{ fov: 32, near: 0.1, far: 600 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMappingExposure: 1.0 }} onPointerDown={e => { dragging.current = true; nav.current.moved = 0; nav.current.lx = e.clientX; nav.current.ly = e.clientY; }} onPointerUp={() => { dragging.current = false; }}>
        <color attach="background" args={[nightMode ? '#070b1d' : '#131a35']} />
        <fog attach="fog" args={[nightMode ? '#0b1028' : '#1a2145', 260, 700]} />
        <ambientLight intensity={nightMode ? 0.45 : 0.75} />
        <hemisphereLight args={nightMode ? [0x8ea2ff, 0x141a35, 0.4] : [0xffe0b3, 0x2a2440, 0.65]} />
        <directionalLight position={[30, 58, 25]} intensity={nightMode ? 0.8 : 1.6} color={nightMode ? '#8ea2ff' : '#ffe7c2'} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
        <directionalLight position={[-28, 22, -30]} intensity={0.5} color="#7dd3fc" />
        <directionalLight position={[0, 14, 48]} intensity={0.5} color="#f0abfc" />
        <Suspense fallback={null}>
          <CityBackdrop />
          <mesh rotation-x={-Math.PI / 2} position-y={-1.3} receiveShadow><boxGeometry args={[84, 62]} /><meshStandardMaterial color="#232c52" roughness={0.9} /></mesh>
          <mesh rotation-x={-Math.PI / 2} position-y={-1.2} receiveShadow><boxGeometry args={[66, 46]} /><meshStandardMaterial color="#2e3a68" roughness={0.85} /></mesh>
          <mesh position-y={-1.05} receiveShadow><boxGeometry args={[60, 0.35, 42]} /><meshStandardMaterial color="#33406f" roughness={0.8} /></mesh>
          {[-18, 0, 18].map(x => <group key={x} position={[x, 0, 25]}><mesh position-y={0.8} castShadow><cylinderGeometry args={[0.09, 0.12, 1.6, 8]} /><meshStandardMaterial color="#3b4670" /></mesh><mesh position-y={1.7}><sphereGeometry args={[0.22, 10, 10]} /><meshStandardMaterial color="#fde68a" emissive={0xfbbf24} emissiveIntensity={2.2} /></mesh><pointLight position-y={1.7} color="#fbbf24" intensity={6} distance={14} decay={2} /></group>)}
          {[-24, -12, 12, 24].map(x => <mesh key={x} rotation-x={-Math.PI / 2} position={[x, -1.0, 0]}><planeGeometry args={[7, 38]} /><meshStandardMaterial color="#3f4c80" roughness={0.85} /></mesh>)}
          {officeFloors.map((_, fi) => (focusFloor < 0 || fi === focusFloor) && <Floor key={fi} fi={fi} agents={byFloor[fi]} logs={logs} onSelect={a => onSelect(detail(a))} dim={focusFloor < 0 && fi > 0} focusAll={focusFloor < 0} nav={nav} />)}
          {focusFloor < 0 && [0, 1].map(g => <group key={g}>
            <Stairs fromY={g * GAP} toY={(g + 1) * GAP} side={-1} />
            <Stairs fromY={g * GAP} toY={(g + 1) * GAP} side={1} />
            <VBalkon y={(g + 1) * GAP} />
          </group>)}
          {focusFloor < 0 && <Lift />}
          <Confetti3D on={celebrate} />
          <ContactShadows position={[0, -0.9, 0]} opacity={0.5} scale={90} blur={2} far={4} />
          <HandoffPaths agents={agents} />
          <Sparkles count={weak ? 20 : 60} scale={[70, 36, 55]} size={2} speed={0.25} opacity={0.35} color="#8ea2ff" position={[0, 12, 0]} />
        </Suspense>
        <CamRig focus={focusFloor} resetToken={resetToken} spin={spin && !followId} dragging={dragging} nav={nav} follow={followPos} />
        {!weak && <EffectComposer><Bloom intensity={0.35} luminanceThreshold={0.55} luminanceSmoothing={0.3} mipmapBlur /><Vignette darkness={0.45} offset={0.3} /></EffectComposer>}
      </Canvas>
      <style>{'@keyframes blink{50%{opacity:0}}'}</style>
    </div>
  );
}

export function preloadCharacters(ids: string[]) {
  for (const id of ids) { try { useGLTF.preload(`/assets/characters/${id}.glb`); } catch { /* abaikan */ } }
}
