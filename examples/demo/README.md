# liteon demo

A complete server-rendered app: signals, templates, a router with auth guards, an
HTTP client, SSR with state transfer, and hydration — no bundler and no build step.

## Run it

**Copy this directory anywhere** — it is a self-contained project. Then:

```sh
npm install         # pulls liteon from the npm registry
npm start           # http://localhost:3000
```

That's the whole setup. No build step, no bundler, no config to edit; `PORT=4000
npm start` if 3000 is taken.

From inside this repository you can also just run `npm install && npm run demo` at
the root, which starts the same app on the same port.

Sign in with any username; the `/dashboard` route is behind a guard, so visiting it
while signed out redirects to `/login?next=/dashboard` — as an HTTP 302 on the
server and as a history navigation in the browser, from the same guard function.

## This app is a consumer, not an insider

Nothing here imports the framework's source tree. Every module uses the bare
specifier, exactly as any installed dependency would:

```js
import { html, signal, createRouter } from 'liteon';
import { renderToString, serializeState } from 'liteon/ssr';
```

That works because [`package.json`](package.json) declares a plain registry
dependency — the same line you'd write in your own project:

```json
"dependencies": { "liteon": "^0.1.2" }
```

So a copy of this directory builds against the published package, with no path
pointing back here.

Run *inside* this repository, the same line resolves to the checkout instead: the
root `package.json` lists this directory under `workspaces`, and the root package is
itself `liteon` at a version satisfying the range — so npm links the local copy
rather than downloading one. Framework edits show up in the demo immediately, and
the integration test exercises your working tree, not the last release. Neither mode
changes a line of app code.

## How the browser resolves `'liteon'`

Node resolves bare specifiers from `node_modules`. Browsers don't: they need a URL.
Rather than introduce a bundler, [`server.js`](server.js) bridges the gap at runtime:

1. It locates the installed package with `import.meta.resolve('liteon')` and reads
   that package's `exports` field.
2. It turns those entry points into an **import map** injected into the HTML shell,
   pointing each specifier at `/vendor/liteon/…`.
3. It serves `/vendor/liteon/*` straight out of `node_modules`.

```html
<script type="importmap">
{"imports":{"liteon":"/vendor/liteon/src/index.js","liteon/ssr":"/vendor/liteon/src/ssr.js"}}
</script>
```

Because the map is derived from the package manifest instead of hand-written, it
can't drift from what the package actually publishes — add an export and the demo
picks it up. Server and browser end up loading the same files from the same install.

## Layout

```
server.js        node:http SSR server, static assets, import map, JSON API
data.js          fake user records + cookie parsing
app/app.js       routes, guards, and the shell layout (runs on both sides)
app/client.js    the browser entry: router.start() then hydrate()
app/store.js     shared signals, seeded from the server's serialized state
app/pages/       home, users, login, dashboard
style.css        styles
```
