import assert from 'node:assert/strict';
import { safePath } from './runner.mjs';
for (const path of ['../secret', '/etc/passwd', 'a/../../secret', 'a\\b', '.git/config', '']) {
  await assert.rejects(() => safePath('project_1', path));
}
await assert.rejects(() => safePath('../bad', 'server.mjs'));
assert.ok((await safePath('project_1', 'src/server.mjs')).endsWith('/project_1/src/server.mjs'));
console.log('runner path boundaries passed');
