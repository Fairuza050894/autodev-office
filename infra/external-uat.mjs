import { chromium } from '/opt/playwright/node_modules/playwright/index.mjs';
const target = new URL(process.env.UAT_URL);
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', proxy: { server: process.env.UAT_PROXY_URL }, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', route => { const url = new URL(route.request().url()); return url.origin === target.origin ? route.continue() : route.abort(); });
  const page = await context.newPage();
  const response = await page.goto(target.href, { waitUntil: 'networkidle', timeout: 30000 });
  if (!response?.ok()) throw new Error('Public application browser response failed');
  if (!(await page.locator('body').innerText()).trim()) throw new Error('Public application empty');
  await page.screenshot({ path: '/workspace/uat-public.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/workspace/uat-public-mobile.png', fullPage: true });
  console.log(JSON.stringify({ passed: 2, failed: 0, screenshots: ['uat-public.png', 'uat-public-mobile.png'] }));
} finally { await browser.close(); }
