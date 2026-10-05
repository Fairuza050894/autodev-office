import type { Row } from '@autodev/ui';

export interface OfficeRoom { name: string; f: string }
export interface OfficeFloor { name: string; short: string; rooms: OfficeRoom[] }

export const officeFloors: OfficeFloor[] = [
  { name: 'Lantai 1 — Operasional', short: 'L1', rooms: [
    { name: 'RECEPTION', f: 'Meja resepsionis · Sofa tunggu' },
    { name: 'PM ROOM', f: 'Meja rapat · Papan sprint' },
    { name: 'BA & PO', f: 'Meja analis · Dinding backlog' },
    { name: 'DESIGN STUDIO', f: 'Meja gambar · Rak referensi' },
    { name: 'ARCHITECTURE', f: 'Whiteboard · Meja arsitek' },
    { name: 'DEV FLOOR', f: 'Meja dev · Rig build' },
  ]},
  { name: 'Lantai 2 — Quality & Rilis', short: 'L2', rooms: [
    { name: 'QA LAB', f: 'Rig uji · Meja QA' },
    { name: 'SECURITY', f: 'SOC wall · Brankas kunci' },
    { name: 'DEVOPS / SERVER', f: 'Rak server · Konsol deploy' },
    { name: 'RELEASE DESK', f: 'Meja rilis · Stempel handover' },
    { name: 'LIBRARY', f: 'Rak buku · Sudut baca' },
  ]},
  { name: 'Lantai 3 — Leisure', short: 'L3', rooms: [
    { name: 'PANTRY', f: 'Dapur · Meja makan' },
    { name: 'GAME ROOM', f: 'Konsol · Meja biliar' },
    { name: 'REST ROOM', f: 'Pods tidur · Sofa' },
    { name: 'GYM', f: 'Treadmill · Beban' },
    { name: 'ROOFTOP LOUNGE', f: 'Deck · Taman' },
  ]},
];

export const officeFlat = officeFloors.flatMap((fl, fi) => fl.rooms.map(r => ({ ...r, floor: fi })));

export function roomOfAgent(a: Row, i: number): number {
  const id = String((a as Record<string, unknown>).id ?? i);
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % officeFlat.length;
  return h;
}

export function isBusyAgent(a: Row): boolean {
  return a.status === 'working' || a.status === 'RUNNING' || Boolean(a.current_task_id);
}

export function agentDot(a: Row): string {
  return isBusyAgent(a) ? '#6366f1' : a.status === 'blocked' ? '#f59e0b' : '#22c55e';
}
