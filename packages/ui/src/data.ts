import { z } from 'zod';
export interface Row {
 [key:string]:unknown;
 id:string;title:string;name:string;email:string;role:string;status:string;stage:string;type:string;kind:string;actor:string;project_id:string;display_name:string;current_task_id:string;assignee_agent:string;client_email:string;client_id:string;autonomy_mode:string;gate:string;decision:string;reason:string;timeout_at:string;requested_at:string;started_at:string;finished_at:string;updated_at:string;created_at:string;ts:string;deadline:string;env:string;version:string;target:string;url:string;mime:string;subject:string;to_email:string;sent_at:string;from_agent:string;content:string;level:string;html:string;body_html:string;code:string;priority_moscow:string;model:string|{provider:string;name:string};
 cost_usd:number;budget_cap_usd:number;tokens_total:number;attempt:number;max_attempts:number;estimate_min:number;actual_min:number;size:number;usd:number;tokens_in:number;tokens_out:number;passed:number;total:number;attempts:number;
 artifact:boolean;email_preview:boolean;
 brief_json:Row;stats_json:Row;inputs_json:Row;output_json:Row;error_json:Row;config_json:Row;payload:Row;payload_json:Row;context:Row;current_task:Row;
 dependencies:string[];depends_on:string[];trace_task_ids:string[];
 tasks:Row[];artifacts:Row[];events:Row[];approvals:Row[];requirements:Row[];test_runs:Row[];deployments:Row[];emails:Row[];usage_costs:Row[];agent_messages:Row[];stages:Row[];items:Row[];projects:Row[];agents:Row[];users:Row[];
 metrics:Row;project:Row;settings:Row;services:Row;worker:Row;user:Row;
 message:string;questions:string[];
 active_projects:number;delivered_month:number;average_duration_minutes:number;success_rate:number;cost_today:number;active_agents:number;completed:number;coverage:number;
 stage_distribution:Row[];throughput:Row[];cost_by_agent:Row[];qa_pass_rate:Row[];needs_attention:Row[];
 summary:string;live_url:string;repo_url:string;requirement_id:string;
}
const strings=['id','title','name','email','role','status','stage','type','kind','actor','project_id','display_name','current_task_id','assignee_agent','client_email','client_id','autonomy_mode','gate','decision','reason','timeout_at','requested_at','started_at','finished_at','updated_at','created_at','ts','deadline','env','target','url','mime','subject','to_email','sent_at','from_agent','level','html','body_html','code','priority_moscow','message'];
const numbers=['cost_usd','budget_cap_usd','tokens_total','attempt','max_attempts','estimate_min','actual_min','size','usd','tokens_in','tokens_out','passed','total','attempts','active_projects','delivered_month','average_duration_minutes','success_rate','cost_today','active_agents','completed','coverage'];
const objects=['brief_json','stats_json','inputs_json','output_json','error_json','config_json','payload','payload_json','context','current_task','metrics','project','settings','services','worker','user'];
const arrays=['tasks','artifacts','events','approvals','requirements','test_runs','deployments','emails','usage_costs','agent_messages','stages','items','projects','agents','users','stage_distribution','throughput','cost_by_agent','qa_pass_rate','needs_attention'];
const shape:Record<string,z.ZodType>={};
for(const key of strings)shape[key]=z.string().nullish();
for(const key of numbers)shape[key]=z.union([z.number(),z.string().regex(/^-?\d+(\.\d+)?$/)]).nullish();
for(const key of objects)shape[key]=z.record(z.unknown()).nullish();
for(const key of arrays)shape[key]=z.array(z.record(z.unknown())).nullish();
for(const key of ['dependencies','depends_on','trace_task_ids','questions'])shape[key]=z.array(z.string()).nullish();
shape.model=z.union([z.string(),z.object({provider:z.string(),name:z.string()}).passthrough()]).nullish();
shape.content=z.union([z.string(),z.record(z.unknown())]).nullish();
shape.version=z.union([z.string(),z.number()]).nullish();
const schema=z.object(shape).passthrough();
export function parseRow(value:unknown):Row { const result=schema.parse(value); for(const key of [...objects,...arrays]) { const nested=result[key]; if(Array.isArray(nested))result[key]=nested.map(parseRow); else if(nested&&typeof nested==='object')result[key]=parseRow(nested); } return result as Row; }
