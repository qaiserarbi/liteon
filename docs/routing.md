# Routing & guards

One router definition runs in two places: the browser (history navigation) and the server (request resolution). Guards are written once and enforced in both.

## Defining routes

```js
import { createRouter } from 'liteon';

export const router = createRouter({
  guards: [logVisit],                    // global: run for every navigation
  routes: [
    { path: '/',          component: Home,      title: 'Home' },
    { path: '/users/:id', component: UserPage },
    { path: '/admin',     component: Admin, guards: [requireAuth] },
    { path: '*',          component: NotFound },   // wildcard fallback
  ],
});
```

- `:name` segments become `params.name` (URL-decoded).
- `*` matches anything not matched above; the server responds `404` for it.
- Extra fields (`title`, `load`, anything) ride along on the matched route — read them from `router.current.value.route`.

## The outlet: `router.view`

Drop it in a template as a child slot; it re-renders when the route changes:

```js
html`<main>${router.view}</main>`
```

The matched `component` is called with `{ params, query }`:

```js
function UserPage({ params, query }) {
  return html`<h1>User ${params.id}</h1>`;
}
```

## Navigating

```js
router.start();                         // call once in the browser:
                                        // intercepts <a href="/..."> clicks + popstate
await router.navigate('/users/7');      // programmatic; returns false if blocked
router.navigate('/login', { replace: true });
router.current.value;                   // signal: { route, params, path, query }
```

Links are plain anchors — no component needed. Opt out per-link with `target`, `download`, or `data-external`. Modifier-clicks (⌘/ctrl/shift) pass through to the browser.

## Guards

A guard is an async function receiving `{ to, from, params, query, server }` and returning:

| Return | Meaning |
| --- | --- |
| `true` | continue |
| `'/some/path'` | redirect — **302 on the server**, history replace in the browser |
| `false` | block — **403 on the server**, navigation cancelled in the browser |

The chain is `[...globalGuards, ...routeGuards]`, stopping at the first non-`true`.

The `server` argument is whatever you pass to `router.resolve(url, server)` — cookies, session, headers. It's `undefined` in the browser, which is how one guard serves both runtimes:

```js
export function requireAuth({ server, to }) {
  const authed = server ? !!server.cookies?.session : !!auth.user.peek();
  return authed ? true : `/login?next=${encodeURIComponent(to.path)}`;
}
```

## On the server

```js
const resolved = await router.resolve(req.url, { cookies });

if (resolved.status === 302) {
  res.writeHead(302, { location: resolved.location });
  return res.end();
}

router.set(resolved);                    // make it the active route
const body = renderToString(App());      // App contains ${router.view}
res.writeHead(resolved.status).end(shell(body)); // 200, 403 or 404
```

`resolve` runs the same guard chain the browser will, so a logged-out request for `/admin` never even renders — it 302s to `/login?next=%2Fadmin`. After the client hydrates and calls `router.start()`, subsequent navigations run the guards client-side.
