/**
 * demo/server — zero-dependency SSR server on node:http.
 *
 *   node examples/demo/server.js     then open http://localhost:3000
 *
 * Per request:
 *   1. /api/*  -> JSON endpoints (login, logout, users)
 *   2. *.js    -> served as native ES modules (no bundler, no build step)
 *   3. pages   -> router.resolve(url) runs guards (302 on redirect),
 *                 data loads, renderToString, state serialized for hydration
 */

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import zlib from 'node:zlib';

import { renderToString, serializeState } from '../../src/ssr.js';
import { USERS, parseCookies } from './data.js';
import { auth, users, frameworkKb } from './app/store.js';
import { App, router } from './app/app.js';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const PORT = process.env.PORT || 3000;

/* --------------- signature: measure our own gzipped size ------------- */

const CORE = ['reactive.js', 'template.js', 'dom.js', 'router.js', 'http.js', 'index.js'];
const source = (
  await Promise.all(CORE.map((f) => readFile(path.join(ROOT, 'src', f), 'utf8')))
).join('\n');
const KB = +(zlib.gzipSync(source).length / 1024).toFixed(1);
frameworkKb.value = KB;

/* ------------------------------ helpers ------------------------------ */

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

function json(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), { 'content-type': 'application/json', ...headers });
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function shell({ title, app, state }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="/examples/demo/style.css">
</head>
<body>
<div id="app">${app}</div>
${state}
<script type="module" src="/examples/demo/app/client.js"></script>
</body>
</html>`;
}

/* ------------------------------- server ------------------------------ */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const cookies = parseCookies(req.headers.cookie);

  try {
    /* ---- API ---- */
    if (url.pathname === '/api/users' && req.method === 'GET') {
      return json(res, 200, USERS);
    }
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const { username } = await readBody(req);
      if (!username || !String(username).trim()) {
        return json(res, 400, { error: 'Username is required.' });
      }
      const name = String(username).trim();
      return json(res, 200, { user: { name } }, {
        'set-cookie': `liteon_user=${encodeURIComponent(name)}; Path=/; HttpOnly; SameSite=Lax`,
      });
    }
    if (url.pathname === '/api/logout' && req.method === 'POST') {
      return json(res, 200, { ok: true }, {
        'set-cookie': 'liteon_user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      });
    }

    /* ---- static assets (framework + app source + styles, no build step) ---- */
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
      const file = path.join(ROOT, path.normalize(url.pathname));
      if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden');
      const type = url.pathname.endsWith('.css')
        ? 'text/css; charset=utf-8'
        : 'text/javascript; charset=utf-8';
      try {
        const code = await readFile(file, 'utf8');
        return send(res, 200, code, { 'content-type': type });
      } catch {
        return send(res, 404, 'Not found');
      }
    }
    if (url.pathname === '/favicon.ico') return send(res, 204, '');

    /* ---- SSR ---- */
    const resolved = await router.resolve(url.pathname + url.search, { cookies });

    if (resolved.status === 302) {
      return send(res, 302, '', { location: resolved.location });
    }

    // Per-request state (single-threaded: set signals, render synchronously).
    auth.user.value = cookies.liteon_user ? { name: cookies.liteon_user } : null;
    users.value = resolved.route?.load === 'users' ? USERS : null;

    router.set(resolved);
    const app = renderToString(App());
    const state = serializeState({
      user: auth.user.peek(),
      users: users.peek(),
      kb: KB,
    });

    return send(res, resolved.status, shell({ title: resolved.route?.title || 'Liteon', app, state }));
  } catch (err) {
    console.error(err);
    return send(res, 500, `<pre>${err.stack}</pre>`);
  }
});

server.listen(PORT, () => {
  console.log(`liteon demo — http://localhost:${PORT}  (framework: ${KB} KB gzipped)`);
});
