/**
 * liteon test runner — node test/run.js
 * Covers everything that runs outside a browser: reactive core, template
 * analysis, SSR output, router matching + guards, HTTP client.
 * (DOM rendering and hydration are exercised by the demo app.)
 */

import assert from 'node:assert/strict';
import { signal, effect, computed, batch, untrack } from '../src/reactive.js';
import { html } from '../src/template.js';
import { renderToString, serializeState, escapeHtml } from '../src/ssr.js';
import { createRouter } from '../src/router.js';
import { createHttp, HttpError } from '../src/http.js';

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}\n${err.stack}`);
    process.exitCode = 1;
  }
}

/* ----------------------------- reactive ------------------------------ */

await test('signal read/write and effect tracking', () => {
  const n = signal(1);
  let seen = [];
  effect(() => seen.push(n.value));
  n.value = 2;
  n.value = 2; // no-op, same value
  n.value = 3;
  assert.deepEqual(seen, [1, 2, 3]);
});

await test('computed derives and stays current', () => {
  const n = signal(2);
  const double = computed(() => n.value * 2);
  assert.equal(double.value, 4);
  n.value = 5;
  assert.equal(double.value, 10);
});

await test('effect dispose stops updates', () => {
  const n = signal(0);
  let runs = 0;
  const stop = effect(() => {
    n.value;
    runs++;
  });
  n.value = 1;
  stop();
  n.value = 2;
  assert.equal(runs, 2);
});

await test('batch flushes effects once', () => {
  const a = signal(1);
  const b = signal(2);
  let runs = 0;
  effect(() => {
    a.value + b.value;
    runs++;
  });
  batch(() => {
    a.value = 10;
    b.value = 20;
  });
  assert.equal(runs, 2); // initial + one batched flush
});

await test('untrack reads without subscribing', () => {
  const n = signal(1);
  let runs = 0;
  effect(() => {
    untrack(() => n.value);
    runs++;
  });
  n.value = 2;
  assert.equal(runs, 1);
});

await test('dynamic dependencies re-track each run', () => {
  const flag = signal(true);
  const a = signal('a');
  const b = signal('b');
  let out;
  effect(() => (out = flag.value ? a.value : b.value));
  flag.value = false;
  assert.equal(out, 'b');
  a.value = 'A'; // no longer a dependency
  assert.equal(out, 'b');
  b.value = 'B';
  assert.equal(out, 'B');
});

/* -------------------------------- SSR -------------------------------- */

await test('renders static template', () => {
  assert.equal(renderToString(html`<p>hello</p>`), '<p>hello</p>');
});

await test('renders child expressions with hydration markers', () => {
  const out = renderToString(html`<p>${'hi'}</p>`);
  assert.equal(out, '<p><!--liteon:0-->hi<!--/liteon:0--></p>');
});

await test('escapes text content', () => {
  const out = renderToString(html`<p>${'<script>alert(1)</script>'}</p>`);
  assert.ok(!out.includes('<script>'));
  assert.ok(out.includes('&lt;script&gt;'));
});

await test('renders signals, functions, arrays, nested templates', () => {
  const n = signal(7);
  const items = [1, 2].map((i) => html`<li>${i}</li>`);
  const out = renderToString(html`<div>${n} ${() => 'fn'} <ul>${items}</ul></div>`);
  assert.ok(out.includes('7'));
  assert.ok(out.includes('fn'));
  assert.ok(out.includes('<li><!--liteon:0-->1<!--/liteon:0--></li>'));
});

await test('renders attributes: plain, boolean, event skipped, bind', () => {
  const name = signal('Ada');
  const out = renderToString(
    html`<input class=${'big'} disabled=${false} onclick=${() => {}} bind=${name} />`
  );
  assert.ok(out.includes('class="big"'));
  assert.ok(!out.includes('disabled'));
  assert.ok(!out.includes('onclick'));
  assert.ok(out.includes('value="Ada"'));
});

await test('escapes attribute values', () => {
  const out = renderToString(html`<div title=${'a"b'}></div>`);
  assert.ok(out.includes('title="a&quot;b"'));
});

await test('null/false/true render as nothing', () => {
  const out = renderToString(html`<p>${null}${false}${true}</p>`);
  assert.equal(out.replace(/<!--.*?-->/g, ''), '<p></p>');
});

await test('serializeState embeds and hardens JSON', () => {
  const s = serializeState({ x: '</script>' });
  assert.ok(s.includes('window.__LITEON__'));
  assert.ok(!s.includes('</script><'));
});

/* ------------------------------- router ------------------------------ */

const routes = [
  { path: '/', component: () => html`home` },
  { path: '/users/:id', component: () => html`user` },
  {
    path: '/admin',
    component: () => html`admin`,
    guards: [({ server }) => (server?.cookies?.auth ? true : '/login')],
  },
  { path: '/blocked', component: () => html`x`, guards: [() => false] },
  { path: '*', component: () => html`404` },
];

await test('matches static and param routes', () => {
  const r = createRouter({ routes });
  assert.equal(r.match('/').route.path, '/');
  const m = r.match('/users/42?tab=posts');
  assert.equal(m.route.path, '/users/:id');
  assert.equal(m.params.id, '42');
  assert.equal(m.query.tab, 'posts');
});

await test('falls back to wildcard with 404', async () => {
  const r = createRouter({ routes });
  const resolved = await r.resolve('/nope');
  assert.equal(resolved.status, 404);
});

await test('guard redirects become 302 on the server', async () => {
  const r = createRouter({ routes });
  const resolved = await r.resolve('/admin', { cookies: {} });
  assert.equal(resolved.status, 302);
  assert.equal(resolved.location, '/login');
});

await test('guard passes with server context', async () => {
  const r = createRouter({ routes });
  const resolved = await r.resolve('/admin', { cookies: { auth: '1' } });
  assert.equal(resolved.status, 200);
});

await test('blocking guard yields 403', async () => {
  const r = createRouter({ routes });
  const resolved = await r.resolve('/blocked');
  assert.equal(resolved.status, 403);
});

await test('global guards run before route guards', async () => {
  const order = [];
  const r = createRouter({
    routes: [
      { path: '/', component: () => html``, guards: [() => (order.push('route'), true)] },
    ],
    guards: [() => (order.push('global'), true)],
  });
  await r.resolve('/');
  assert.deepEqual(order, ['global', 'route']);
});

/* -------------------------------- http ------------------------------- */

function fakeFetch(handler) {
  return async (url, init) => {
    const { status = 200, body = {}, headers = {} } = await handler(url, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: '',
      headers: { get: (k) => headers[k.toLowerCase()] ?? 'application/json' },
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
}

await test('http.get parses JSON and applies baseURL', async () => {
  const api = createHttp({
    baseURL: '/api',
    fetch: fakeFetch((url) => {
      assert.equal(url, '/api/users');
      return { body: [{ id: 1 }] };
    }),
  });
  const data = await api.get('/users');
  assert.deepEqual(data, [{ id: 1 }]);
});

await test('http.post serializes JSON body and sets header', async () => {
  const api = createHttp({
    fetch: fakeFetch((url, init) => {
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['content-type'], 'application/json');
      assert.deepEqual(JSON.parse(init.body), { a: 1 });
      return { body: { ok: true } };
    }),
  });
  assert.deepEqual(await api.post('/x', { a: 1 }), { ok: true });
});

await test('request interceptor can mutate config', async () => {
  const api = createHttp({
    fetch: fakeFetch((url, init) => {
      assert.equal(init.headers.authorization, 'Bearer t');
      return { body: {} };
    }),
  });
  api.interceptors.request.use((cfg) => {
    cfg.headers.authorization = 'Bearer t';
    return cfg;
  });
  await api.get('/x');
});

await test('non-2xx throws HttpError with parsed body', async () => {
  const api = createHttp({
    fetch: fakeFetch(() => ({ status: 404, body: { error: 'nope' } })),
  });
  await assert.rejects(api.get('/x'), (err) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 404);
    assert.equal(err.body.error, 'nope');
    return true;
  });
});

/* ------------------------------- report ------------------------------ */

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`);
