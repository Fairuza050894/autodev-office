import type { Row } from '@autodev/ui';

// Manifest karakter 19 agen → /assets/characters/{id}.glb
// ponytail: placeholder procedural aktif sampai .glb CC0 diunduh (lihat scripts/generate-characters.md)
export interface CharEntry { id: string; file: string; accessory: string; color: string; license: string; source: string }
const CC0 = 'CC0 (komersial OK)';
const Q = 'Quaternius Ultimate Humanoids';
export const CHARACTERS: Record<string, CharEntry> = {
  cs_agent: { id: 'cs_agent', file: '/assets/characters/cs_agent.glb', accessory: 'headset+mic', color: '#22d3ee', license: CC0, source: Q },
  account_agent: { id: 'account_agent', file: '/assets/characters/account_agent.glb', accessory: 'tablet+tas', color: '#22d3ee', license: CC0, source: Q },
  architect_agent: { id: 'architect_agent', file: '/assets/characters/architect_agent.glb', accessory: 'topi-proyek+lampu', color: '#f59e0b', license: CC0, source: Q },
  ba_agent: { id: 'ba_agent', file: '/assets/characters/ba_agent.glb', accessory: 'papan-kerja+dasi', color: '#a78bfa', license: CC0, source: Q },
  backend_dev: { id: 'backend_dev', file: '/assets/characters/backend_dev.glb', accessory: 'laptop+headset', color: '#6366f1', license: CC0, source: Q },
  frontend_dev: { id: 'frontend_dev', file: '/assets/characters/frontend_dev.glb', accessory: 'laptop+headset', color: '#6366f1', license: CC0, source: Q },
  mobile_dev: { id: 'mobile_dev', file: '/assets/characters/mobile_dev.glb', accessory: 'ponsel-uji+headset', color: '#6366f1', license: CC0, source: Q },
  data_agent: { id: 'data_agent', file: '/assets/characters/data_agent.glb', accessory: 'ransel+kacamata', color: '#6366f1', license: CC0, source: Q },
  designer_agent: { id: 'designer_agent', file: '/assets/characters/designer_agent.glb', accessory: 'baret+kacamata-bulat', color: '#e879f9', license: CC0, source: Q },
  writer_agent: { id: 'writer_agent', file: '/assets/characters/writer_agent.glb', accessory: 'baret+buku', color: '#e879f9', license: CC0, source: Q },
  qa_agent: { id: 'qa_agent', file: '/assets/characters/qa_agent.glb', accessory: 'kacamata+kamera-uji', color: '#22c55e', license: CC0, source: Q },
  security_agent: { id: 'security_agent', file: '/assets/characters/security_agent.glb', accessory: 'helm+visor', color: '#ef4444', license: CC0, source: Q },
  devops_agent: { id: 'devops_agent', file: '/assets/characters/devops_agent.glb', accessory: 'topi-proyek+tablet', color: '#f59e0b', license: CC0, source: Q },
  release_agent: { id: 'release_agent', file: '/assets/characters/release_agent.glb', accessory: 'topi-proyek+stempel', color: '#f59e0b', license: CC0, source: Q },
  pm_agent: { id: 'pm_agent', file: '/assets/characters/pm_agent.glb', accessory: 'topi-datar+dasi', color: '#a78bfa', license: CC0, source: Q },
  po_agent: { id: 'po_agent', file: '/assets/characters/po_agent.glb', accessory: 'topi-datar+papan', color: '#a78bfa', license: CC0, source: Q },
  tech_lead: { id: 'tech_lead', file: '/assets/characters/tech_lead.glb', accessory: 'headset+jubah-lead', color: '#6366f1', license: CC0, source: Q },
  compliance_agent: { id: 'compliance_agent', file: '/assets/characters/compliance_agent.glb', accessory: 'helm+perisai', color: '#ef4444', license: CC0, source: Q },
  estimator_agent: { id: 'estimator_agent', file: '/assets/characters/estimator_agent.glb', accessory: 'kalkulator+kacamata', color: '#f59e0b', license: CC0, source: Q },
};
export function charEntry(a: Row, i: number): CharEntry {
  const id = String((a as Record<string, unknown>).id ?? '');
  return CHARACTERS[id] ?? { id: id || `agen-${i}`, file: `/assets/characters/${id || `agen-${i}`}.glb`, accessory: 'headset', color: '#6366f1', license: CC0, source: Q };
}
// Status → klip animasi (crossfade 0.3s di loader)
export function animFor(a: Row): string {
  const s = String(a.status ?? (a.current_task_id ? 'RUNNING' : 'idle')).toUpperCase();
  if (s === 'RUNNING' || s === 'WORKING') return 'typing';
  if (s === 'BLOCKED' || s === 'ESCALATED') return 'thinking';
  if (s === 'DONE') return 'celebrate';
  if (s === 'FAILED') return 'error';
  if (s === 'HANDOFF' || s === 'VALIDATING') return 'walking';
  if (s === 'TALKING') return 'talking';
  return 'idle';
}
