import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';
import { z } from 'zod';

const detailSchema = z.object({status:z.string(),tasks:z.array(z.object({id:z.string(),status:z.string()})),emails:z.array(z.object({id:z.string(),status:z.string()}))});

test('worker dihentikan lalu restart: tugas selesai tetap sama, email delivery tidak ganda', async ({ request }) => {
  expect((await request.post('/api/v1/auth/login', {data:{email:'admin@autodev.local',password:'AutoDevLocal2026!'}})).ok()).toBe(true);
  const response=await request.post('/api/v1/projects',{data:{prompt:'Landing page klinik gigi: profil dokter, daftar layanan, kontak',email:'resume-e2e@example.com'}});
  expect(response.ok()).toBe(true);
  const {id}=z.object({id:z.string()}).parse(await response.json());
  let doneIds:string[]=[];
  await expect.poll(async()=>{
    const detail=detailSchema.parse(await(await request.get(`/api/v1/projects/${id}`)).json());
    doneIds=detail.tasks.filter(task=>task.status==='DONE').map(task=>task.id);
    return doneIds.length>0 && detail.status!=='DELIVERED';
  },{timeout:30000,intervals:[100,200]}).toBe(true);
  execFileSync('docker',['compose','kill','-s','SIGKILL','worker'],{stdio:'pipe'});
  try {
    const checkpoint=detailSchema.parse(await(await request.get(`/api/v1/projects/${id}`)).json());
    for(const taskId of doneIds) expect(checkpoint.tasks.find(task=>task.id===taskId)?.status).toBe('DONE');
  } finally {execFileSync('docker',['compose','up','-d','worker'],{stdio:'pipe'});}
  let completed:z.infer<typeof detailSchema>={status:'',tasks:[],emails:[]};
  await expect.poll(async()=>{
    completed=detailSchema.parse(await(await request.get(`/api/v1/projects/${id}`)).json());
    if(completed.status==='FAILED') throw new Error(JSON.stringify(completed));
    return completed.status;
  },{timeout:290000,intervals:[1000,2000]}).toBe('DELIVERED');
  for(const taskId of doneIds) expect(completed.tasks.find(task=>task.id===taskId)?.status).toBe('DONE');
  expect(new Set(completed.tasks.map(task=>task.id)).size).toBe(completed.tasks.length);
  const messages=await request.get('http://localhost:8025/api/v1/messages');
  const mailSchema=z.object({messages:z.array(z.object({To:z.array(z.object({Address:z.string()})),Subject:z.string()}))});
  const captured=mailSchema.parse(await messages.json()).messages.filter(message=>message.To.some(to=>to.Address==='resume-e2e@example.com') && /live|selesai|delivered/i.test(message.Subject));
  expect(captured).toHaveLength(1);
});
