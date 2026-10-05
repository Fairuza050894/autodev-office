import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseRow } from '@autodev/ui';
import { criticalPath } from './critical-path';
test('critical path uses duration rather than depth and terminates cycles',()=>{const tasks=[{id:'start',estimate_min:1,depends_on:[]},{id:'short',estimate_min:2,depends_on:['start']},{id:'long',estimate_min:20,depends_on:['start']},{id:'end',estimate_min:1,depends_on:['short','long']}].map(parseRow);assert.deepEqual([...criticalPath(tasks).edges],['long-end','start-long']);assert.equal(criticalPath([{id:'cycle',depends_on:['cycle']}].map(parseRow)).nodes.size,1);});
