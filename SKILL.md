---
name: liteon
description: Build web apps and components with liteon, a ~4.3 KB JavaScript frontend framework (signals, tagged-template rendering, isomorphic routing with guards, HTTP client, and SSR + hydration — no virtual DOM, no build step). Use this skill whenever the user is working in a liteon project or asks to create, edit, or debug liteon code — including any mention of "liteon", `signal`/`computed`/`effect`, the `html\`\`` template tag, `createRouter`, route guards, `renderToString`/`hydrate`, or importing from "liteon" or "liteon/ssr". Also use it when someone wants a tiny/dependency-free/no-build-step SPA, an SSR app with reusable server+client components, or a fine-grained reactive UI, even if they don't name liteon explicitly.
---

# liteon

liteon is a fine-grained reactive frontend framework in ~700 lines of dependency-free ES modules. It renders directly to the DOM (no virtual DOM, no diffing), and the *same* component functions run on the server (to a string) and in the browser (hydrated in place). There is no build step — the browser imports the same `.js` files Node runs.

Your job with this skill: write idiomatic liteon code, and reach for the right primitive instead of reinventing it. The whole point of liteon is that it's small enough to hold in your head — so lean on its exact API rather than porting React/Vue idioms that don't apply (there are no re-renders, no hooks, no dependency arrays, no keys).

## The one mental-model shift that matters

**Component functions run once.** A component is a plain function returning a template; it is a *constructor*, not a render function. State changes never re-run the component — they update the exact DOM node bound to the changed signal. This is the single most common source of mistakes when coming from React.

```js
// WRONG (React brain): reading .value at construction "freezes" it
html`<span>${count.value}</span>`      // renders once, never updates

// RIGHT: pass the signal itself, or wrap in a function, so liteon can track it
html`<span>${count}</span>`            // live: signal bound directly
html`<span>${() => count.value * 2}</span>`  // live: function re-runs on change
```

Rule of thumb: **anything dynamic in a template is either a signal passed directly, or a `() => ...` function.** A bare `expr.value` at the top level of a template is read once and frozen.

## Public API (import surface)

```js
// browser + shared (from 'liteon')
import {
  signal, computed, effect, batch, untrack, isSignal,
  html, isTemplate,
  render, hydrate,
  createRouter,
  createHttp, http, HttpError,
  getServerState,
} from 'liteon';

// server-only (from 'liteon/ssr' — never ship to the browser)
import { renderToString, serializeState, escapeHtml } from 'liteon/ssr';
```

Also available as subpath imports: `liteon/reactive`, `liteon/router`, `liteon/http`.

## Reactivity

```js
const n = signal(0);        // writable container
n.value;                    // read (subscribes if inside effect/template)
n.value = 5;                // write (notifies; skipped if Object.is-equal)
n.peek();                   // read WITHOUT subscribing — use in handlers/guards

const double = computed(() => n.value * 2);   // derived, read-only, eager
const stop = effect(() => console.log(n.value)); // runs now + on every change; stop() disposes
batch(() => { a.value = 1; b.value = 2; });   // one flush instead of two
untrack(() => n.value);     // read without creating a dependency
```

- Use `computed` for derived values, `effect` for side effects (syncing `document.title`, logging). `render`/`hydrate` create effects internally for every dynamic slot — you rarely need `effect` by hand.
- Use `.peek()` inside event handlers and guards where you want the current value but no subscription (e.g. reading form fields on submit).
- Dependencies are re-collected every run, so conditional reads work — no dependency arrays.

## Templates (`html\`\``)

`html` is a tagged template literal — nothing is parsed at call time. The browser parses the static markup once per template shape (cached), and each `${...}` is wired to the node it controls.

**Child slots** (between tags) accept: strings/numbers (escaped), signals/computeds (live text), `() => ...` functions (live region), other `html\`\`` templates (nesting), arrays (great with `.map()`), and `null`/`undefined`/`false`/`true` (render nothing).

```js
html`<ul>${() => users.value.map(u => html`<li>${u.name}</li>`)}</ul>`      // list
html`${() => error.value ? html`<p class="err">${error}</p>` : null}`       // conditional
```

**Attribute slots** must be the **entire** attribute value, and for dynamic attributes write them **unquoted**:

```js
html`<a href=${url} class=${() => active.value ? 'active' : ''}>Home</a>`
html`<button disabled=${busy}>Save</button>`   // busy is a signal → live
```

- Partial interpolation like `class="btn ${x}"` is **not** supported. Compose the whole value: `` class=${`btn ${x}`} ``.
- Falsy (`false`/`null`/`undefined`) removes the attribute; `true` sets it empty. `value`/`checked`/`disabled`/`selected` are set as properties so form controls behave.

**Special attributes:**

```js
html`<button onclick=${() => count.value++}>+</button>`   // on<event>=${fn}
html`<input bind=${name} />`                              // two-way binding (signal <-> input)
html`<input ref=${el => el.focus()} />`                   // ref: called with the element
```

`bind` keeps an input's value and a signal in sync both ways (checkboxes bind `checked` to a boolean). On the server it renders the current value into the HTML so forms arrive pre-filled.

**Components compose by being functions** — no props system, no context. Pass arguments; share state through module-level signals.

```js
const Badge = (label) => html`<em class="badge">${label}</em>`;
html`<p>status: ${Badge('ok')}</p>`
```

## Mounting

```js
import { render, hydrate } from 'liteon';
render(App(), document.getElementById('app'));   // clear container, mount fresh (client-only apps)
hydrate(App(), document.getElementById('app'));   // reuse server-rendered DOM (SSR apps)
```

Both return a disposer function.

## Routing + guards

Guards are the standout feature: one guard function runs identically on server and client. It receives `{ to, from, params, query, server }` and returns `true` (pass), a string (redirect), or `false` (block). The `server` argument is present only during server-side `resolve()` — that's how the same guard reads a cookie on the server and a signal in the browser.

```js
import { createRouter, html } from 'liteon';

function requireAuth({ server, to }) {
  const authed = server ? !!server.cookies?.session : !!auth.user.peek();
  return authed ? true : `/login?next=${encodeURIComponent(to.path)}`;
}

export const router = createRouter({
  guards: [/* global guards run before route guards */],
  routes: [
    { path: '/',          component: Home,      title: 'Home' },
    { path: '/users/:id', component: UserPage },              // :id -> params.id
    { path: '/dashboard', component: Dashboard, guards: [requireAuth] },
    { path: '*',          component: NotFound },              // wildcard fallback -> 404
  ],
});
```

Matched `component` is called with `{ params, query }`. Extra route fields (`title`, `load`, anything) ride along on `router.current.value.route`.

**Browser:**
```js
router.start();                     // once: intercepts <a href="/…"> clicks + popstate
await router.navigate('/users/7');  // programmatic; resolves false if a guard blocked
router.current.value;               // reactive { route, params, path, query }
html`<main>${router.view}</main>`   // reactive outlet — re-renders on route change
```

**Server:**
```js
const resolved = await router.resolve(req.url, { cookies }); // runs the guard chain
// resolved.status is 200 | 302 (with resolved.location) | 403 | 404
if (resolved.status === 302) { /* send a 302 redirect to resolved.location */ }
router.set(resolved);               // make it current BEFORE renderToString(App())
```

Guard return values map to HTTP on the server: redirect → **302**, block → **403**, no match → **404**. In the browser the same returns become a history replace or a cancelled navigation.

## HTTP client

```js
import { createHttp, http, HttpError } from 'liteon';

const api = createHttp({ baseURL: '/api', headers: { 'x-app': 'demo' } });
const users = await api.get('/users');            // JSON parsed automatically
await api.post('/users', { name: 'Ada' });        // object body → JSON + content-type
api.interceptors.request.use(cfg => { cfg.headers.authorization = token; return cfg; });
```

- `get/delete/head(url, options)`; `post/put/patch(url, body, options)`.
- Non-2xx **throws** `HttpError` with `.status`, parsed `.body`, and `.response`. Catch it: `if (err instanceof HttpError) err.body?.error`.
- `http` is a ready-made instance with no baseURL.

## SSR + hydration

The same components render to a string on the server and hydrate (reuse that exact DOM) in the browser. State fetched on the server is transferred so the client never refetches.

**Server:**
```js
import { renderToString, serializeState } from 'liteon/ssr';

const resolved = await router.resolve(url, { cookies });
if (resolved.status === 302) return redirect(resolved.location);
router.set(resolved);
users.value = await loadData();                    // fill signals before rendering
const body = renderToString(App());                // App contains ${router.view}
const stateTag = serializeState({ users: users.peek(), user });  // <script>window.__LITEON__=…</script>
// send: <div id="app">${body}</div> ${stateTag} <script type="module" src="/client.js"></script>
```

**Client:**
```js
import { hydrate, getServerState } from 'liteon';
const state = getServerState();                    // window.__LITEON__ ?? null
users.value = state?.users ?? null;                // initialize signals BEFORE building templates
router.start();
hydrate(App(), document.getElementById('app'));
```

Because signals start from the server's data, the client's first render agrees with the server HTML — no flash, no refetch. If a region disagrees (stale/time-dependent), liteon re-renders just that region; a whole-tree mismatch falls back to a client render. **Hydration is an optimization, never a correctness risk.**

## Idiomatic patterns

**Shared store** — put app state in a module of signals; import it anywhere (server and client). Initialize from `getServerState()` at module top so SSR data flows in:
```js
import { signal, computed, createHttp, getServerState } from 'liteon';
const initial = getServerState() || {};
export const users = signal(initial.users || null);
export const search = signal('');
export const filtered = computed(() =>
  (users.value || []).filter(u => u.name.toLowerCase().includes(search.value.toLowerCase())));
```

**Async loading pattern:**
```js
const data = signal(null), error = signal(null);
async function load() {
  try { data.value = await http.get('/api/thing'); }
  catch (e) { error.value = e.body?.error ?? e.message; }
}
html`${() => error.value ? html`<p class="err">${error}</p>`
             : data.value ? renderList(data.value)
             : html`<p>Loading…</p>`}`
```

## Common mistakes to avoid

- **Freezing values:** `${count.value}` in a template renders once. Use `${count}` or `${() => count.value}`.
- **Quoted dynamic attributes:** write `class=${x}`, not `class="${x}"`; and never partial (`"btn ${x}"`).
- **Touching `window`/`document` at component construction:** components run on the server too. Put DOM/browser access in event handlers, `ref`, or `effect` (effects only run where you `render`/`hydrate`).
- **Expecting re-renders / using keys:** there are none. Reactivity lives in values (signals/computeds), not in components.
- **Forgetting `router.set(resolved)` before `renderToString`** on the server, or `getServerState()` before building templates on the client.
- **Reaching for `liteon/ssr` in browser code:** it's server-only; keep the client bundle tiny.

## Reference

Full guides live in `docs/` of the liteon project: `getting-started.md`, `reactivity.md`, `templates.md`, `routing.md`, `http.md`, `ssr.md`. The source (`src/*.js`, ~700 commented lines) is the ultimate reference and is short enough to read directly when a detail is unclear. A complete working SSR app — server, store, guarded routes, two-way-bound forms, API-fed lists — is in `examples/demo/`; read it to see every feature wired together end-to-end.
