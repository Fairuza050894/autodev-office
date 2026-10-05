import { test, expect } from '@playwright/test';
import { z } from 'zod';

const projectSchema = z.object({
  status: z.string(), live_url: z.string().nullable().default(null),
  tasks: z.array(z.object({ status: z.string() })),
  test_runs: z.array(z.object({ failed: z.number(), passed: z.number() })),
  emails: z.array(z.object({ status: z.string() })),
  artifacts: z.array(z.object({ type: z.string(), name: z.string() }))
});

test('chat klinik menghasilkan aplikasi sehat, bukti QA dan email sebelum DELIVERED', async ({ page, request }) => {
  const login = await request.post('/api/v1/auth/login', { data: { email: 'admin@autodev.local', password: 'AutoDevLocal2026!' } });
  expect(login.ok()).toBe(true);
  await page.goto('/');
  await expect(page.locator('body')).toContainText(/autodev/i);
  await page.locator('input[name="email"]').fill('admin@autodev.local');
  await page.locator('input[name="password"]').fill('AutoDevLocal2026!');
  await page.getByRole('button', { name: /masuk ke kantor/i }).click();
  await expect(page.locator('body')).toContainText(/Ringkasan|Proyek|Kantor virtual/i);
  const sessionResponse = await request.post('/api/v1/chat/sessions', { data: {} });
  expect(sessionResponse.ok()).toBe(true);
  const session = z.object({ id: z.string() }).parse(await sessionResponse.json());
  const klinikEmail=`klinik-${Date.now()}@example.com`;
  const response = await request.post(`/api/v1/chat/sessions/${session.id}/messages`, {
    data: { message: `Buatkan website company profile untuk klinik gigi dengan profil dokter, layanan, formulir janji temu. Email saya ${klinikEmail}.` }
  });
  expect(response.ok()).toBe(true);
  const intake = z.object({ project_id: z.string() }).parse(await response.json());
  expect(intake.project_id).toBeTruthy();
  let project: z.infer<typeof projectSchema> = { status: '', live_url: null, tasks: [], test_runs: [], emails: [], artifacts: [] };
  await expect.poll(async () => {
    const detail = await request.get(`/api/v1/projects/${intake.project_id}`);
    expect(detail.ok()).toBe(true);
    project = projectSchema.parse(await detail.json());
    if (['FAILED', 'REJECTED', 'CANCELLED'].includes(project.status)) throw new Error(JSON.stringify(project));
    return project.status;
  }, { timeout: 290000, intervals: [1000, 2000] }).toBe('DELIVERED');
  expect(project.live_url).toBeTruthy();
  const live = await request.get(z.string().url().parse(project.live_url));
  expect(live.ok()).toBe(true);
  expect(await live.text()).toMatch(/klinik|gigi/i);
  expect(project.tasks.every(task => task.status === 'DONE')).toBe(true);
  expect(project.test_runs.some(run => run.failed === 0 && run.passed > 0)).toBe(true);
  expect(project.emails.some(email => ['sent', 'delivered'].includes(email.status))).toBe(true);
  expect(project.artifacts.some(artifact => /security/i.test(artifact.type + artifact.name))).toBe(true);
  const mail = await request.get('http://localhost:8025/api/v1/messages');
  expect(mail.ok()).toBe(true);
  expect(JSON.stringify(await mail.json())).toContain(klinikEmail);
  await page.goto(`/projects/${intake.project_id}`);
  await expect(page.locator('body')).toContainText('DELIVERED');
});
