import http from 'node:http';
const token = process.env.RUNNER_TOKEN;
if (!token || token.length < 32) throw new Error('RUNNER_TOKEN required');
http.createServer(async (request, response) => {
  try {
    if (request.url === '/health') { response.writeHead(200); response.end('ok'); return; }
    if (!/^\/live\/[a-zA-Z0-9_-]+(?:\/|\?|$)/.test(request.url || '')) { response.writeHead(404); response.end(); return; }
    const body = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > 1000000) throw new Error('Request too large'); body.push(chunk); }
    const headers = { authorization: `Bearer ${token}` };
    for (const key of ['content-type', 'accept']) if (typeof request.headers[key] === 'string') headers[key] = request.headers[key];
    if (typeof request.headers.cookie === 'string') headers.cookie = request.headers.cookie.split(';').filter(value => value.trim().startsWith('app_admin=')).join(';');
    const result = await fetch(`${process.env.RUNNER_URL || 'http://runner:4100'}${request.url}`, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : Buffer.concat(body), redirect: 'manual', signal: AbortSignal.timeout(20000) });
    const outgoing = { 'content-security-policy': "default-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cross-origin-opener-policy': 'same-origin' };
    for (const key of ['content-type', 'cache-control']) if (result.headers.get(key)) outgoing[key] = result.headers.get(key);
    const cookie = result.headers.get('set-cookie'); if (cookie?.startsWith('app_admin=')) outgoing['set-cookie'] = cookie;
    const location = result.headers.get('location'); if (location && !location.startsWith('//') && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(location)) outgoing.location = location;
    response.writeHead(result.status, outgoing); response.end(Buffer.from(await result.arrayBuffer()));
  } catch { response.writeHead(502); response.end('Application unavailable'); }
}).listen(4400, '0.0.0.0');
