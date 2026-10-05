import { test, expect } from '@playwright/test';
import { z } from 'zod';

test('QA gagal disengaja tercatat, perbaikan otomatis diuji ulang sebelum delivery', async ({ request }) => {
  expect((await request.post('/api/v1/auth/login',{data:{email:'admin@autodev.local',password:'AutoDevLocal2026!'}})).ok()).toBe(true);
  const response=await request.post('/api/v1/projects',{data:{prompt:'Toko Kopi Senja: katalog kopi, keranjang, checkout QRIS sandbox, admin produk dan pesanan',email:'repair-e2e@example.com',config_json:{inject_test_failure:true}}});
  expect(response.ok()).toBe(true);
  const {id}=z.object({id:z.string()}).parse(await response.json());
  const schema=z.object({status:z.string(),qa_cycles:z.number().optional(),test_runs:z.array(z.object({failed:z.number(),passed:z.number()})),bugs:z.array(z.object({status:z.string()}))});
  let result:z.infer<typeof schema>={status:'',test_runs:[],bugs:[]};
  await expect.poll(async()=>{
    result=schema.parse(await(await request.get(`/api/v1/projects/${id}`)).json());
    if(result.status==='FAILED')throw new Error(JSON.stringify(result));
    return result.status;
  },{timeout:290000,intervals:[1000,2000]}).toBe('DELIVERED');
  expect(result.qa_cycles).toBeGreaterThanOrEqual(1);
  expect(result.test_runs.some(run=>run.failed>0)).toBe(true);
  expect(result.test_runs.at(-1)?.failed).toBe(0);
  expect(result.bugs.every(bug=>['fixed','resolved','closed'].includes(bug.status.toLowerCase()))).toBe(true);
});
