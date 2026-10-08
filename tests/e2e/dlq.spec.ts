import { test, expect } from '@playwright/test';
import { z } from 'zod';

test('DLQ endpoint tampil dan UI render tanpa confirm()', async ({ page, request }) => {
  expect((await request.post('/api/v1/auth/login', { data: { email: 'admin@autodev.local', password: 'AutoDevLocal2026!' } })).ok()).toBe(true);
  const dlq = await request.get('/api/v1/dead_letters');
  expect(dlq.ok()).toBe(true);
  z.object({ items: z.array(z.unknown()), total: z.number() }).parse(await dlq.json());
  const health = await request.get('/api/v1/health');
  expect(health.ok()).toBe(true);
  const services = z.object({ services: z.record(z.string()) }).parse(await health.json());
  expect(services.services['api']).toBe('healthy');
  await page.goto('/');
  await expect(page.locator('body')).toContainText(/autodev/i);
  await page.locator('input[name="email"]').fill('admin@autodev.local');
  await page.locator('input[name="password"]').fill('AutoDevLocal2026!');
  await page.getByRole('button', { name: /masuk ke kantor/i }).click();
  await expect(page.locator('body')).toContainText(/Ringkasan|Proyek|Kantor virtual/i);
  await page.goto('/dead_letters');
  await expect(page.locator('body')).toContainText(/Kegagalan permanen|Bersih/i);
  await page.goto('/tasks');
  await expect(page.locator('body')).toContainText(/Tugas|Semua tugas/i);
});
