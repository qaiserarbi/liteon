# SSR & hydration

The same components render to a string on the server and come alive in the browser — without rebuilding the DOM they arrived in.

## Server: render + transfer state

```js
import { renderToString, serializeState } from 'liteon/ssr'; // server-only module

// 1. resolve the route (guards run here — see routing.md)
const resolved = await router.resolve(req.url, { cookies });
router.set(resolved);

// 2. load data the page needs, put it in your signals
users.value = await db.listUsers();

// 3. render and ship, embedding the state
const html = `<!doctype html>
<html><body>
  <div id="app">${renderToString(App())}</div>
  ${serializeState({ users: users.peek(), user: session?.user ?? null })}
  <script type="module" src="/app/client.js"></script>
</body></html>`;
```

`renderToString` unwraps signals and functions to their current values, escapes all text (interpolations can't inject HTML), skips event handlers, and renders `bind=${sig}` as the input's `value` so forms arrive pre-filled.

`serializeState(obj)` emits `<script>window.__LITEON__ = {...}</script>` with `<` escaped so state can't break out of the tag.

## Client: pick up the state, hydrate

```js
import { hydrate, getServerState } from 'liteon';
import { router } from './app.js';

// initialize signals from the transfer BEFORE creating templates
const state = getServerState();          // window.__LITEON__ ?? null
users.value = state?.users ?? null;

router.start();
hydrate(App(), document.getElementById('app'));
```

Because the signals start with the server's data, the first client render *agrees* with the server HTML — no flash, no refetch.

## How hydration works

The server wraps every dynamic child region in comment markers:

```html
<main><!--liteon:3--> ...page HTML... <!--/liteon:3--></main>
```

`hydrate` walks the compiled template and the live DOM side by side:

- **Static elements and text are reused as-is.** Event listeners and reactive attributes attach to the nodes already on the page — nothing is recreated.
- **Regions hydrate recursively.** The region's current value (a nested template, a signal's text, a list) is matched against the server-rendered content inside the markers; nested templates carry their own markers, so reuse goes all the way down.
- **Later updates re-render only their region**, exactly like client-side rendering.

## Mismatches are safe

If the client's first value for a region disagrees with what the server sent — stale auth, clock-dependent text, anything — that region alone is re-rendered with the client's truth. If the whole shell can't be matched, `hydrate` falls back to a full client render. Hydration is an optimization, never a correctness risk: the page always ends up showing what the client's state says.

## Rules of thumb

1. **Initialize signals from `getServerState()` before calling any component.** Module-level stores make this natural (see `examples/demo/app/store.js`).
2. **Keep components pure at construction.** They run on the server too — don't touch `window` during setup; do it in event handlers or `effect`s (effects only run where you `render`/`hydrate`).
3. **Escape nothing yourself.** Interpolated text is always escaped; if you need raw HTML you almost certainly want a nested template instead.
4. **`liteon/ssr` never ships to the browser.** Import it only in server code; the client bundle stays at 4.3 KB total.
