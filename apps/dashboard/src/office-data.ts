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

// 1 agen per ruangan (16 ruangan, 19 agen): slot 0-15 tetap, 3 agen ekstra ke ruangan besar.
// ponytail: 19 slot tetap manual; ganti ke aturan kapasitas saat ruangan >20.
const AGENT_ROOM: Record<string, number> = {
  cs_agent: 0, pm_agent: 1, ba_agent: 2, designer_agent: 3, architect_agent: 4,
  backend_dev: 5, tech_lead: 15,
  qa_agent: 6, security_agent: 7, devops_agent: 8, release_agent: 9,
  data_agent: 10, writer_agent: 11, account_agent: 12,
  frontend_dev: 13, mobile_dev: 14,
  po_agent: 2, compliance_agent: 7, estimator_agent: 1,
};
export function roomOfAgent(a: Row, _i: number): number {
  const id = String((a as Record<string, unknown>).id ?? '');
  if (id in AGENT_ROOM) return AGENT_ROOM[id];
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
