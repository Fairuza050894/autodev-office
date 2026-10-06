import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseRow } from './data';
test('API rows preserve nested data and reject malformed collections',()=>{const data=parseRow({project:{id:'p',tasks:[{id:'t',status:'RUNNING',depends_on:['previous']}]},items:[],cost_usd:'0.03'});assert.equal(data.project.tasks[0]?.id,'t');assert.equal(data.cost_usd,'0.03');assert.throws(()=>parseRow({items:'not an array'}));assert.throws(()=>parseRow({status:42}));assert.equal(parseRow({secret_masked:true}).secret_masked,true);assert.equal(parseRow({worker:'healthy'}).worker,'healthy');assert.equal(parseRow({worker:{status:'running'}}).worker.status,'running');});
