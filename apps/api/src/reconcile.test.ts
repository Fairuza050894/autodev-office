import { describe, it, expect } from 'vitest';
import { reconcileStartup } from './reconcile.js';
function fakeStore(state: { projects: any[]; tasks: any[]; emails: any[] }) {
  const events: any[] = [];
  return {
    state, events,
    async listProjects() { return state.projects; },
    async listTasks(id: string) { return state.tasks.filter((t) => t.project_id === id); },
    async listRecords(table: string) { return table === 'emails' ? state.emails : []; },
    async updateProject(id: string, patch: any) { Object.assign(state.projects.find((p) => p.id === id)!, patch); },
    async emit(e: any) { events.push(e); },
  } as any;
}
describe('reconcileStartup', () => {
  it('releases stale budget reservation after crash, keeps active lease', async () => {
    const store = fakeStore({
      projects: [{ id: 'p1', reserved_usd: 1.5, reserved_tokens: 100 }, { id: 'p2', reserved_usd: 2, reserved_tokens: 50 }],
      tasks: [{ project_id: 'p2', status: 'RUNNING', lease_until: new Date(Date.now() + 60000).toISOString() }],
      emails: [],
    });
    const r = await reconcileStartup(store);
    expect(r.budgetsReleased).toBe(1);
    expect(store.state.projects[0].reserved_usd).toBe(0);
    expect(store.state.projects[1].reserved_usd).toBe(2);
    expect(store.events.some((e: { type: string }) => e.type === 'budget.reconciled')).toBe(true);
  });
  it('surfaces ambiguous sending email without resending', async () => {
    const store = fakeStore({ projects: [], tasks: [], emails: [{ id: 'e1', project_id: 'p1', status: 'sending' }] });
    const r = await reconcileStartup(store);
    expect(r.ambiguousEmails).toBe(1);
    expect(store.events.some((e: { type: string }) => e.type === 'email.ambiguous')).toBe(true);
    expect(store.state.emails[0].status).toBe('sending');
  });
});
