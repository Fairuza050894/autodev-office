import { test, expect } from '@playwright/test';
import { z } from 'zod';

const gateProject = z.object({ status: z.string(), approvals: z.array(z.object({ id: z.string(), decision: z.string().nullable().optional() })) });

test('GATED_PROPOSAL menunggu keputusan admin sebelum pekerjaan dilanjutkan', async ({ request }) => {
  expect((await request.post('/api/v1/auth/login', { data: { email: 'admin@autodev.local', password: 'AutoDevLocal2026!' } })).ok()).toBe(true);
  const response = await request.post('/api/v1/projects', { data: {
    prompt: 'Website company profile klinik: profil dokter, layanan, kontak', email: 'gate-e2e@example.com', autonomy_mode: 'GATED_PROPOSAL'
  } });
  expect(response.ok()).toBe(true);
  const { id } = z.object({ id: z.string() }).parse(await response.json());
  let approvalId = '';
  await expect.poll(async () => {
    const detail = gateProject.parse(await (await request.get(`/api/v1/projects/${id}`)).json());
    approvalId = detail.approvals.find(approval => !approval.decision)?.id ?? '';
    return detail.status;
  }, { timeout: 60000 }).toBe('WAITING_APPROVAL');
  expect(approvalId).not.toBe('');
  const decision = await request.post(`/api/v1/approvals/${approvalId}/decision`, { data: { decision: 'reject', reason: 'Pengujian gate admin' } });
  expect(decision.ok()).toBe(true);
  await expect.poll(async () => z.object({ status: z.string() }).parse(await (await request.get(`/api/v1/projects/${id}`)).json()).status).toMatch(/REJECTED|CANCELLED/);
  const duplicate = await request.post(`/api/v1/approvals/${approvalId}/decision`, { data: { decision: 'approve', reason: 'Tidak boleh mengganti keputusan final' } });
  expect(duplicate.status()).toBe(409);
});
