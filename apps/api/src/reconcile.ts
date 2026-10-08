import { randomUUID } from 'node:crypto';
import type { OfficeStore } from '@autodev/shared';
// Startup reconciler: release stale budget reservations left by crash,
// surface ambiguous SMTP states. Never auto-resends email.
export async function reconcileStartup(store: OfficeStore): Promise<{ budgetsReleased: number; ambiguousEmails: number }> {
  const now = Date.now();
  let budgetsReleased = 0, ambiguousEmails = 0;
  const emit = (project_id: string, type: string, payload: Record<string, unknown>) =>
    store.emit({ id: randomUUID(), ts: new Date().toISOString(), project_id, type, actor: 'worker', payload });
  for (const p of await store.listProjects()) {
    const usd = Number(p.reserved_usd ?? 0), tokens = Number(p.reserved_tokens ?? 0);
    if (!(usd > 0 || tokens > 0)) continue;
    const tasks = await store.listTasks(p.id);
    const active = tasks.some((t) => ['RUNNING', 'VALIDATING'].includes(t.status) && Date.parse(t.lease_until ?? t.heartbeat_at ?? '') > now);
    if (active) continue;
    await store.updateProject(p.id, { reserved_usd: 0, reserved_tokens: 0 });
    await emit(p.id, 'budget.reconciled', { released_usd: usd, released_tokens: tokens });
    budgetsReleased++;
  }
  for (const m of await store.listRecords('emails', '')) {
    if (m.status !== 'sending') continue;
    await emit(String(m.project_id ?? 'system'), 'email.ambiguous', { email_id: m.id });
    ambiguousEmails++;
  }
  return { budgetsReleased, ambiguousEmails };
}
