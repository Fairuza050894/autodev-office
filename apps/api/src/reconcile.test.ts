import { describe, it, expect } from 'vitest';
import { reconcileStartup } from './reconcile.js';
import type { OfficeEvent, OfficeStore, Project, Task } from '@autodev/shared';
type TestState = { projects: Array<Record<string, unknown>>; tasks: Array<Record<string, unknown>>; emails: Array<Record<string, unknown>> };
function fakeStore(state: TestState) {
  const events: OfficeEvent[] = [];
  const store = {
    state, events,
    async listProjects() { return state.projects as unknown as Project[]; },
    async listTasks(id: string) { return state.tasks.filter((t) => t['project_id'] === id) as unknown as Task[]; },
    async listRecords(table: string) { return table === 'emails' ? state.emails : []; },
    async updateProject(id: string, patch: Partial<Project>) { Object.assign(state.projects.find((p) => p['id'] === id) as Record<string, unknown>, patch); },
    async emit(e: OfficeEvent) { events.push(e); },
  };
  return store as unknown as OfficeStore & typeof store;
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
    expect(store.state.projects[0]['reserved_usd']).toBe(0);
    expect(store.state.projects[1]['reserved_usd']).toBe(2);
    expect(store.events.some((e) => e.type === 'budget.reconciled')).toBe(true);
  });
  it('surfaces ambiguous sending email without resending', async () => {
    const store = fakeStore({ projects: [], tasks: [], emails: [{ id: 'e1', project_id: 'p1', status: 'sending' }] });
    const r = await reconcileStartup(store);
    expect(r.ambiguousEmails).toBe(1);
    expect(store.events.some((e) => e.type === 'email.ambiguous')).toBe(true);
    expect(store.state.emails[0]['status']).toBe('sending');
  });
});
