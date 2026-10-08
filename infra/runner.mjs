import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, lstat, writeFile, readFile, readdir, chown, chmod, cp, rm } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';

const root = process.env.WORKSPACE_ROOT || '/workspaces';
const stateRoot = process.env.RUNNER_STATE_ROOT || '/state';
const volume = process.env.WORKSPACE_VOLUME || 'autodev-workspaces';
const image = process.env.SANDBOX_IMAGE || 'autodev-sandbox:local';
const token = process.env.RUNNER_TOKEN;
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const fileSchema = z.object({ path: z.string().min(1).max(300), content: z.string().max(2_000_000) }).strict();
const runSchema = z.object({ project_id: idSchema, files: z.array(fileSchema).max(150).default([]), command: z.array(z.string().max(2000)).min(1).max(100), branch: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,100}$/).optional(), timeout_ms: z.number().int().min(100).max(180000).default(60000) }).strict();
const deploySchema = z.object({ project_id: idSchema, version: z.string().regex(/^[a-zA-Z0-9._-]{1,80}$/), target: z.enum(['docker-local', 'coolify']).default('docker-local') }).strict();
const rollbackSchema = z.object({ project_id: idSchema, container_id: z.string().regex(/^[a-zA-Z0-9_-]{1,150}$/).optional() }).strict();
const stateSchema = z.object({ current: z.string(), previous: z.string().optional(), version: z.string(), setup_url: z.string().optional(), remote_url: z.string().url().optional() });
const locks = new Map();
export async function safePath(project, path) {
  idSchema.parse(project);
  if (path.includes('\\') || path.split('/').some(p => p === '..' || p === '.git' || p === '.releases') || path.startsWith('/') || path.includes('\0')) throw new Error('Unsafe workspace path');
  const base = resolve(root, project), target = resolve(base, path);
  if (!relative(base, target) || relative(base, target).startsWith('..')) throw new Error('Unsafe workspace path');
  let cursor = target;
  while (cursor !== resolve(root)) {
    try { if ((await lstat(cursor)).isSymbolicLink()) throw new Error('Symlinks forbidden'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    cursor = dirname(cursor);
  }
  return target;
}
function docker(args, timeout = 60000) {
  return new Promise((resolveResult, reject) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', overflow = false;
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    for (const [stream, name] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) stream.on('data', chunk => {
      if (stdout.length + stderr.length + chunk.length > 4_000_000) { overflow = true; child.kill('SIGKILL'); return; }
      if (name === 'stdout') stdout += chunk; else stderr += chunk;
    });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); resolveResult({ exit_code: overflow ? 137 : code ?? 124, stdout, stderr }); });
  });
}
const restrictions = ['--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '128', '--memory', '768m', '--cpus', '1', '--user', '1000:1000', '--tmpfs', '/tmp:rw,noexec,nosuid,size=128m', '--env', 'HOME=/tmp', '--env', 'GIT_CONFIG_COUNT=2', '--env', 'GIT_CONFIG_KEY_0=user.name', '--env', 'GIT_CONFIG_VALUE_0=AutoDev Agent', '--env', 'GIT_CONFIG_KEY_1=user.email', '--env', 'GIT_CONFIG_VALUE_1=agent@autodev.local', '--workdir', '/workspace'];
function mount(project, readonly = false) { return ['--mount', `type=volume,source=${volume},target=/workspace,volume-subpath=${project}${readonly ? ',readonly' : ''}`]; }
async function initialize(project) {
  idSchema.parse(project); const dir = resolve(root, project);
  await mkdir(dir, { recursive: true });
  if ((await lstat(dir)).isSymbolicLink()) throw new Error('Symlinks forbidden');
  await chown(dir, 1000, 1000);
}
async function files(project, dir = '', output = []) {
  if (output.length >= 150) return output;
  for (const entry of await readdir(resolve(root, project, dir), { withFileTypes: true })) {
    if (['.git', 'node_modules', 'source.zip', '.releases'].includes(entry.name) || entry.isSymbolicLink()) continue;
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await files(project, path, output);
    else if (entry.isFile()) {
      const target = await safePath(project, path), stat = await lstat(target);
      if (stat.size <= 500000) { const data = await readFile(target); if (!data.includes(0)) output.push({ path, content: data.toString('utf8') }); }
    }
    if (output.length >= 150) break;
  }
  return output;
}
async function run(input) {
  const data = runSchema.parse(input);
  if (!['node', 'git', 'zip', 'sh'].includes(data.command[0])) throw new Error('Command executable not allowed');
  await initialize(data.project_id);
  if (data.branch) {
    const checkout = await docker(['run', '--rm', ...restrictions, ...mount(data.project_id), image, 'git', 'checkout', '-B', data.branch, 'develop'], data.timeout_ms);
    if (checkout.exit_code !== 0) throw new Error(checkout.stderr);
  }
  for (const file of data.files) {
    const target = await safePath(data.project_id, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, { mode: 0o600 }); await chown(target, 1000, 1000);
    let dir = dirname(target); while (dir !== resolve(root)) { await chown(dir, 1000, 1000); dir = dirname(dir); }
  }
  const name = `autodev-job-${data.project_id}-${Date.now()}`;
  try {
    const result = await docker(['run', '--rm', '--name', name, ...restrictions, ...mount(data.project_id), image, ...data.command], data.timeout_ms);
    await enforceQuota(data.project_id);
    return { ...result, files: await files(data.project_id) };
  } finally { await docker(['rm', '-f', name], 10000); }
}
async function state(project) { try { return stateSchema.parse(JSON.parse(await readFile(resolve(stateRoot, `${project}.json`), 'utf8'))); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; } }
async function save(project, value) { await mkdir(stateRoot, { recursive: true }); await writeFile(resolve(stateRoot, `${project}.json`), JSON.stringify(value), { mode: 0o600 }); }
async function requestContainer(container, path, method = 'GET', headers = {}, body = '') {
  const script = `const r=await fetch('http://127.0.0.1:8080'+process.argv[1],{method:process.argv[2],headers:JSON.parse(process.argv[3]),body:process.argv[2]==='GET'||process.argv[2]==='HEAD'?undefined:Buffer.from(process.argv[4],'base64'),redirect:'manual'});console.log(JSON.stringify({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer()).toString('base64')}));`;
  const result = await docker(['exec', container, 'node', '--input-type=module', '-e', script, path, method, JSON.stringify(headers), body], 15000);
  if (result.exit_code !== 0) throw new Error('Deployment unavailable');
  return z.object({ status: z.number().int(), headers: z.record(z.string()), body: z.string() }).parse(JSON.parse(result.stdout));
}
async function deploy(input) {
  const data = deploySchema.parse(input); await initialize(data.project_id);
  if (data.target === 'coolify') {
    const base = z.string().url().parse(process.env.COOLIFY_URL);
    const credential = z.string().min(1).parse(process.env.COOLIFY_TOKEN);
    const app = z.string().regex(/^[a-zA-Z0-9_-]+$/).parse(process.env.COOLIFY_APP_UUID);
    const publicUrl = z.string().url().parse(process.env.COOLIFY_PUBLIC_URL);
    const response = await fetch(`${base.replace(/\/$/, '')}/api/v1/deploy?uuid=${encodeURIComponent(app)}&force=false`, { method: 'GET', headers: { authorization: `Bearer ${credential}` }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Coolify deployment failed: ${response.status}`);
    z.object({ deployments: z.array(z.object({ deployment_uuid: z.string() }).passthrough()) }).passthrough().parse(await response.json());
    let healthy = false;
    for (let attempt = 0; attempt < 90; attempt++) { try { const result = await fetch(`${publicUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(5000), redirect: 'error' }); if (result.ok) { const body = await result.text(); healthy = body.includes(data.version); if (healthy) break; } } catch {} await new Promise(resolveWait => setTimeout(resolveWait, 2000)); }
    if (!healthy) throw new Error('Coolify health/version verification failed');
    await save(data.project_id, { current: `coolify-${app}`, version: data.version, remote_url: publicUrl });
    return { url: publicUrl, internal_url: publicUrl, container_id: `coolify-${app}`, healthy: true };
  }
  const previous = await state(data.project_id);
  if (previous?.version === data.version) {
    if ((await requestContainer(previous.current, '/health')).status !== 200) throw new Error('Existing deployment unhealthy');
    return { url: `${process.env.PUBLIC_LIVE_URL || 'http://127.0.0.1:4400'}/live/${data.project_id}/`, internal_url: `http://runner:4100/live/${data.project_id}/`, container_id: previous.current, healthy: true, setup_url: previous.setup_url };
  }
  const name = `autodev-live-${data.project_id}-${createHash('sha256').update(data.version).digest('hex').slice(0,12)}`;
  const snapshot = `${data.project_id}/.releases/${createHash('sha256').update(data.version).digest('hex').slice(0,12)}`;
  const snapshotPath = resolve(root, snapshot);
  await rm(snapshotPath, { recursive: true, force: true });
  await mkdir(snapshotPath, { recursive: true });
  for (const entry of await readdir(resolve(root, data.project_id), { withFileTypes: true })) {
    if (['.releases', '.git', 'source.zip'].includes(entry.name)) continue;
    const source = await safePath(data.project_id, entry.name);
    await cp(source, resolve(snapshotPath, entry.name), { recursive: true, filter: async path => !(await lstat(path)).isSymbolicLink() });
  }
  async function readable(dir) { await chmod(dir, 0o755); for (const entry of await readdir(dir, { withFileTypes: true })) { const path = resolve(dir, entry.name); if (entry.isDirectory()) await readable(path); else await chmod(path, 0o444); } }
  await readable(snapshotPath);
  await docker(['rm', '-f', name], 10000);
  const setupToken = randomBytes(32).toString('hex');
  const adminToken = randomBytes(32).toString('hex');
  const setup_url = `${process.env.PUBLIC_LIVE_URL || 'http://127.0.0.1:4400'}/live/${data.project_id}/setup?token=${setupToken}`;
  const result = await docker(['run', '-d', '--name', name, '--restart', 'unless-stopped', '--label', `autodev.project=${data.project_id}`, ...restrictions, '--env', `PROJECT_ID=${data.project_id}`, '--env', `APP_SETUP_TOKEN=${setupToken}`, '--env', `APP_ADMIN_TOKEN=${adminToken}`, '--env', `APP_SETUP_EXPIRES_AT=${new Date(Date.now() + 15 * 60000).toISOString()}`, ...mount(snapshot, true), image, 'node', 'server.mjs']);
  if (result.exit_code !== 0) throw new Error(result.stderr);
  let healthy = false;
  for (let attempt = 0; attempt < 30; attempt++) { try { healthy = (await requestContainer(name, '/health')).status === 200; if (healthy) break; } catch {} await new Promise(resolveWait => setTimeout(resolveWait, 250)); }
  if (!healthy) { await docker(['rm', '-f', name]); throw new Error('Deployment health check failed'); }
  await save(data.project_id, { current: name, previous: previous?.current === name ? previous.previous : previous?.current, version: data.version, setup_url });
  if (previous?.current && previous.current !== name) await docker(['stop', previous.current]);
  await pruneSnapshots(data.project_id);
  await pruneContainers(data.project_id);
  return { url: `${process.env.PUBLIC_LIVE_URL || 'http://127.0.0.1:4400'}/live/${data.project_id}/`, internal_url: `http://runner:4100/live/${data.project_id}/`, container_id: name, healthy, setup_url };
}
// Retensi snapshot: keep current + previous, hapus sisanya sesuai SNAPSHOT_RETENTION_DAYS.
// ponytail: tanpa filter umur per-file (inode mtime tak andal di volume); tambah bila perlu.
async function pruneSnapshots(project) {
  idSchema.parse(project);
  const dir = resolve(root, project, '.releases');
  let names = [];
  try { names = (await readdir(dir)).filter((n) => /^[a-f0-9]{12}$/.test(n)); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  if (names.length <= 2) return;
  const current = await state(project);
  const keep = new Set([current?.current?.split('-').at(-1), current?.previous?.split('-').at(-1)].filter(Boolean));
  for (const n of names) {
    if (keep.has(n)) continue;
    await rm(resolve(dir, n), { recursive: true, force: true });
  }
}
// Retensi container: hapus container label autodev.project selain current+previous.
async function pruneContainers(project) {
  idSchema.parse(project);
  const current = await state(project);
  const keep = new Set([current?.current, current?.previous].filter(Boolean));
  const list = await docker(['ps', '-a', '--filter', `label=autodev.project=${project}`, '--format', '{{.Names}}']);
  if (list.exit_code !== 0) return;
  for (const name of list.stdout.split('\n').map((s) => s.trim()).filter(Boolean)) {
    if (keep.has(name)) continue;
    await docker(['rm', '-f', name], 10000);
  }
}
async function rollback(input) {
  const data = rollbackSchema.parse(input), current = await state(data.project_id);
  if (!current) throw new Error('No deployment');
  if (current.remote_url) throw new Error('External rollback requires Coolify provider runbook; no local container rollback available');
  const target = data.container_id || current.previous;
  if (!target || ![current.current, current.previous].includes(target)) throw new Error('No authorized rollback target');
  const result = await docker(['start', target]); if (result.exit_code !== 0) throw new Error(result.stderr);
  if ((await requestContainer(target, '/health')).status !== 200) throw new Error('Rollback health check failed');
  if (target !== current.current) await docker(['stop', current.current]);
  await save(data.project_id, { current: target, previous: current.current, version: 'rollback' });
  return { status: 'rolled_back', container_id: target, healthy: true };
}
async function uat(input) {
  const { project_id } = z.object({ project_id: idSchema }).strict().parse(input);
  const deployment = await state(project_id); if (!deployment) throw new Error('No deployment');
  if (deployment.remote_url) {
    const proxy = z.string().url().parse(process.env.UAT_PROXY_URL);
    const network = z.string().regex(/^[a-zA-Z0-9_-]+$/).parse(process.env.UAT_EGRESS_NETWORK);
    const name = `autodev-uat-${project_id}-${Date.now()}`;
    try {
      const result = await docker(['run', '--rm', '--name', name, '--network', network, ...restrictions.slice(2), '--env', `UAT_URL=${deployment.remote_url}`, '--env', `UAT_PROXY_URL=${proxy}`, ...mount(project_id), image, 'node', '/opt/autodev/external-uat.mjs'], 120000);
      return { ...result, files: await files(project_id) };
    } finally { await docker(['rm', '-f', name], 10000); }
  }
  const name = `autodev-uat-${project_id}-${Date.now()}`;
  const isolated = restrictions.slice(2);
  try {
    const result = await docker(['run', '--rm', '--name', name, '--network', `container:${deployment.current}`, ...isolated, '--env', 'UAT_EXTERNAL=true', ...mount(project_id), image, 'node', 'screenshot.mjs'], 120000);
    return { ...result, files: await files(project_id) };
  } finally { await docker(['rm', '-f', name], 10000); }
}
async function archive(input) {
  const { project_id } = z.object({ project_id: idSchema }).strict().parse(input);
  const result = await run({ project_id, command: ['zip', '-q', '-r', 'source.zip', '.', '-x', '.git/*', 'node_modules/*', '.releases/*', 'source.zip'] });
  if (result.exit_code !== 0) throw new Error(result.stderr);
  const data = await readFile(await safePath(project_id, 'source.zip'));
  return { path: `${root}/${project_id}/source.zip`, checksum: createHash('sha256').update(data).digest('hex'), size: data.length };
}
async function publish(input) {
  const data = z.object({ project_id: idSchema, repo_name: idSchema }).strict().parse(input);
  const user = idSchema.parse(process.env.GITEA_USER || 'autodev');
  const credential = process.env.GITEA_TOKEN || (await readFile(process.env.GITEA_TOKEN_FILE || '/integration/gitea-token', 'utf8')).trim();
  const base = process.env.GITEA_URL || 'http://gitea:3000';
  async function call(path, method = 'GET', body) {
    const result = await fetch(`${base}/api/v1${path}`, { method, headers: { authorization: `token ${credential}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    if (!result.ok && result.status !== 404) throw new Error(`Gitea operation failed: ${result.status}`);
    return { status: result.status, body: result.status === 404 ? undefined : await result.json() };
  }
  const repoPath = `/repos/${user}/${data.repo_name}`;
  if ((await call(repoPath)).status === 404) await call('/user/repos', 'POST', { name: data.repo_name, private: true, auto_init: true, default_branch: 'main' });
  let commits = 0;
  for (const file of await files(data.project_id)) {
    const path = `${repoPath}/contents/${file.path.split('/').map(encodeURIComponent).join('/')}`;
    const existing = await call(path);
    const record = existing.status === 404 ? undefined : z.object({ sha: z.string(), content: z.string().optional() }).passthrough().parse(existing.body);
    if (record?.content && Buffer.from(record.content.replace(/\s/g, ''), 'base64').toString('utf8') === file.content) continue;
    await call(path, record ? 'PUT' : 'POST', { branch: 'main', content: Buffer.from(file.content).toString('base64'), message: `AutoDev: ${file.path}`, ...(record ? { sha: record.sha } : {}) });
    commits++;
  }
  return { repo_url: `http://localhost:3001/${user}/${data.repo_name}`, commits };
}
async function scan(input) {
  const { project_id } = z.object({ project_id: idSchema }).strict().parse(input);
  const findings = [];
  for (const file of await files(project_id)) {
    if (!/\.(mjs|js|ts|json|env)$/.test(file.path)) continue;
    if (!['test.mjs', 'screenshot.mjs', 'security.mjs'].includes(file.path) && /\beval\s*\(|new Function\s*\(|child_process/.test(file.content)) findings.push({ severity: 'high', path: file.path, rule: 'unsafe-execution' });
    if (/sk-[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}/.test(file.content)) findings.push({ severity: 'critical', path: file.path, rule: 'embedded-secret' });
    if (file.path === 'package.json') {
      const pkg = z.object({ dependencies: z.record(z.string()).optional() }).passthrough().parse(JSON.parse(file.content));
      if (pkg.dependencies && Object.keys(pkg.dependencies).length) findings.push({ severity: 'high', path: file.path, rule: 'dependency-audit-unavailable', message: 'Dependencies require authenticated registry audit; network-none cannot verify advisories.' });
    }
  }
  const server = (await files(project_id)).find(file => file.path === 'server.mjs');
  for (const header of ['x-content-type-options', 'content-security-policy']) if (!server?.content.toLowerCase().includes(header)) findings.push({ severity: 'high', path: 'server.mjs', rule: `missing-${header}` });
  return { scanner: 'trusted-basic-static-v1', critical: findings.filter(item => item.severity === 'critical').length, high: findings.filter(item => item.severity === 'high').length, findings };
}
async function enforceQuota(project) {
  let bytes = 0, count = 0;
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (++count > 10000) throw new Error('Workspace file-count quota exceeded');
      const path = resolve(dir, entry.name), stat = await lstat(path);
      bytes += stat.size; if (bytes > 256 * 1024 * 1024) throw new Error('Workspace 256MB quota exceeded');
      if (entry.isSymbolicLink()) throw new Error('Workspace contains symlink');
      if (entry.isDirectory()) await walk(path);
    }
  }
  await walk(resolve(root, project));
}
async function serial(project, action) {
  const previous = locks.get(project) || Promise.resolve();
  const next = previous.catch(() => {}).then(action); locks.set(project, next);
  try { return await next; } finally { if (locks.get(project) === next) locks.delete(project); }
}
function authorized(request) {
  const value = request.headers.authorization || '';
  const expected = `Bearer ${token}`;
  return value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
export function createServer() {
  if (!token || token.length < 32) throw new Error('RUNNER_TOKEN must contain at least 32 characters');
  return http.createServer(async (request, response) => {
    try {
      if (!authorized(request)) { response.writeHead(401); response.end('Unauthorized'); return; }
      const url = new URL(request.url || '/', 'http://runner');
      if (request.method === 'GET' && url.pathname === '/health') { const result = await docker(['info', '--format', '{{.ServerVersion}}'], 5000); response.writeHead(result.exit_code === 0 ? 200 : 503); response.end(JSON.stringify({ healthy: result.exit_code === 0 })); return; }
      const live = url.pathname.match(/^\/live\/([a-zA-Z0-9_-]+)(\/.*)?$/);
      if (live) {
        const project = idSchema.parse(live[1]), deployment = await state(project); if (!deployment) throw new Error('No deployment');
        const body = []; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > 1_000_000) throw new Error('Request too large'); body.push(chunk); }
        const headers = {}; for (const key of ['content-type', 'accept', 'cookie']) if (typeof request.headers[key] === 'string') headers[key] = request.headers[key];
        const result = await requestContainer(deployment.current, (live[2] || '/') + url.search, request.method, headers, Buffer.concat(body).toString('base64'));
        const safeHeaders = {}; for (const key of ['content-type', 'cache-control', 'location', 'set-cookie']) if (result.headers[key]) safeHeaders[key] = result.headers[key];
        response.writeHead(result.status, safeHeaders); response.end(Buffer.from(result.body, 'base64')); return;
      }
      if (request.method !== 'POST') { response.writeHead(404); response.end(); return; }
      let body = ''; for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 8_000_000) throw new Error('Request too large'); }
      const input = JSON.parse(body), project = idSchema.parse(z.object({ project_id: idSchema }).passthrough().parse(input).project_id);
      const actions = { '/run': run, '/deploy': deploy, '/rollback': rollback, '/archive': archive, '/git/publish': publish, '/uat': uat, '/scan': scan };
      if (!Object.hasOwn(actions, url.pathname)) { response.writeHead(404); response.end(); return; }
      const output = await serial(project, () => actions[url.pathname](input));
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(output));
    } catch (error) { response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Runner request failed' })); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) createServer().listen(Number(process.env.PORT || 4100), '0.0.0.0');
