import { test, expect } from '@playwright/test';
import { z } from 'zod';
import { execFileSync } from 'node:child_process';

test('budget keras menghentikan workflow sebelum delivery', async ({ request }) => {
  expect((await request.post('/api/v1/auth/login', { data: { email: 'admin@autodev.local', password: 'AutoDevLocal2026!' } })).ok()).toBe(true);
  const response = await request.post('/api/v1/projects', { data: {
    prompt: 'Website company profile klinik dengan profil, layanan, kontak', email: 'budget-e2e@example.com', budget_cap_usd: 1
  } });
  expect(response.ok()).toBe(true);
  const { id } = z.object({ id: z.string() }).parse(await response.json());
  z.string().uuid().parse(id);
  // Mock tidak memakai token berbayar; fixture mensimulasikan ledger biaya yang sudah tercatat.
  execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'autodev', '-d', 'autodev', '-c', `UPDATE projects SET data = jsonb_set(data, '{cost_usd}', '1'::jsonb) WHERE id = '${id}'`], { stdio: 'pipe' });
  await expect.poll(async () => {
    const detail = z.object({ status: z.string(), events: z.array(z.object({ type: z.string() })) }).parse(await (await request.get(`/api/v1/projects/${id}`)).json());
    expect(detail.status).not.toBe('DELIVERED');
    return detail.status === 'PAUSED' && detail.events.some(event => event.type === 'budget.exceeded');
  }, { timeout: 30000 }).toBe(true);
});
