import { createOfficeEngine } from '@autodev/orchestrator';
import { createRuntime } from '@autodev/agent-runtime';
import { store,pool } from './store.js';
import { portalToken,decrypt } from './security.js';
import { z } from 'zod';
const client=await pool.connect();
const lock=z.object({acquired:z.boolean()}).parse((await client.query('SELECT pg_try_advisory_lock(42027) AS acquired')).rows[0]);
if(!lock?.acquired)throw new Error('Another durable worker owns the scheduler lease');
const config=z.record(z.unknown()).parse((await pool.query("SELECT data FROM settings WHERE id='global'")).rows[0]?.data??{});
if(typeof config.secrets_encrypted==='string'){const keys=z.record(z.string()).parse(decrypt(config.secrets_encrypted));for(const [key,value] of Object.entries(keys))if(/^(OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|COOLIFY_TOKEN|RESEND_API_KEY|SMTP_PASSWORD)$/.test(key))process.env[key]=value;}
if(typeof config.llm_mode==='string')process.env.LLM_MODE=config.llm_mode;
if(typeof config.deploy_target==='string')process.env.DEPLOY_TARGET=config.deploy_target;
if(config.smtp){const smtp=z.object({host:z.string().optional(),port:z.coerce.number().int().positive().optional(),user:z.string().optional(),secure:z.boolean().optional(),from:z.string().optional()}).parse(config.smtp);if(smtp.host)process.env.SMTP_HOST=smtp.host;if(smtp.port)process.env.SMTP_PORT=String(smtp.port);if(smtp.user)process.env.SMTP_USER=smtp.user;if(smtp.secure!==undefined)process.env.SMTP_SECURE=String(smtp.secure);if(smtp.from)process.env.EMAIL_FROM=smtp.from;}
if(config.brand){const brand=z.object({name:z.string().optional()}).parse(config.brand);if(brand.name)process.env.COMPANY_NAME=brand.name;}
if(config.models){const models=z.record(z.object({provider:z.string(),name:z.string(),temperature:z.number().min(0).max(2).optional(),max_output_tokens:z.number().int().positive().optional()})).parse(config.models);for(const [id,model] of Object.entries(models)){const agent=await store.getRecord('agents',id);if(agent)await store.putRecord('agents',{...agent,model:{...z.record(z.unknown()).parse(agent.model),...model}});}}
if(config.email_templates){const templates=z.record(z.string()).parse(config.email_templates);if(templates.delivered)process.env.EMAIL_TEMPLATE_DELIVERED=templates.delivered;}
const runtime=createRuntime({store,runnerUrl:process.env.RUNNER_URL??process.env.SANDBOX_URL,runnerToken:process.env.RUNNER_TOKEN??process.env.SANDBOX_TOKEN,portalUrl:async project=>`${process.env.DASHBOARD_URL??'http://localhost:3000'}/portal/${portalToken(project.id)}`});
const engine=createOfficeEngine({store,runtime,concurrency:Number(process.env.WORKER_CONCURRENCY??4)});
async function heartbeat(){await pool.query("INSERT INTO settings(id,data) VALUES('worker',$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()",[JSON.stringify({status:'running',heartbeat_at:new Date().toISOString(),pid:process.pid})]);}
await heartbeat();const timer=setInterval(()=>void heartbeat().catch(error=>console.error(JSON.stringify({level:'error',message:'worker heartbeat failed',error:String(error)}))),5000);
const stop=async()=>{clearInterval(timer);await engine.stop();await client.query('SELECT pg_advisory_unlock(42027)');client.release();await pool.end();process.exit(0);};process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
await engine.start();
