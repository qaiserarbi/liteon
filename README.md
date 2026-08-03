# liteon_

**The lightest full-featured frontend framework in the world.**
Signals, templates, SSR + hydration, routing with guards, and an HTTP client — **4.3 KB min+gzip, all in**. No build step. No virtual DOM. No dependencies.

```
reactive core    0.5 KB │ signal · computed · effect · batch
templates + DOM  2.9 KB │ html`` tag · events · two-way bind · lists
router           1.3 KB │ params · wildcards · async guards · SSR resolve
http client      0.6 KB │ interceptors · JSON · typed errors
ssr              0.9 KB │ renderToString · state transfer · hydration markers
────────────────────────
everything       4.3 KB min+gzip (shared code dedupes across modules)
```

## Sixty-second tour

```js
import { signal, computed, html, render } from 'liteon';

const count = signal(0);
const doubled = computed(() => count.value * 2);

render(
  html`
    <button onclick=${() => count.value++}>clicked ${count} times</button>
    <p>doubled: ${doubled}</p>
  `,
  document.getElementById('app')
);
```

No compiler. `html` is a tagged template literal — the browser parses your markup once into a `<template>`, and liteon wires each `${expression}` directly to the exact DOM node it controls. When a signal changes, only that text node or attribute updates. There is no virtual DOM to diff because there is nothing to diff: dependencies are known, updates are surgical.

## What's in the box

- **Signals** — `signal`, `computed`, `effect`, `batch`, `untrack`. Fine-grained reactivity, automatic dependency tracking, no stale closures.
- **Templates** — events (`onclick=${fn}`), two-way binding (`bind=${sig}`), element refs (`ref=${fn}`), reactive attributes, lists via `.map()`, conditionals via ternaries. Plain JavaScript all the way down.
- **SSR + hydration** — the same components render to a string on the server and hydrate in the browser. Server DOM is *reused*, not rebuilt; any mismatch falls back to a re-render of just that region, so hydration is an optimization, never a correctness risk. Server state transfers via `serializeState` / `getServerState` so the client never refetches what the server already knew.
- **Router** — `:params`, `*` wildcards, query parsing, and async **guards** that run identically on server and client: return `true` to pass, or `'/login'` to redirect (an HTTP 302 on the server, a history navigation in the browser).
- **HTTP client** — `http.get/post/put/patch/delete`, request/response interceptors, automatic JSON, and `HttpError` with `.status` and parsed `.body`.
- **TypeScript-ready** — the runtime is dependency-free modern JavaScript (no build step), and hand-written `.d.ts` declarations ship with the package: `signal<number>(0)`, `api.get<User[]>('/users')`, typed guards and templates all check under `--strict`. Verify with `npm run typecheck`.

## Run the demo

```sh
npm install        # dev deps only (tests); the framework itself has none
npm run demo       # http://localhost:3000
```

The demo is a complete SSR app — login with guards, a users list fed by an API, two-way-bound search, live client navigation — served with **zero build step**: the browser imports the same ES modules Node runs.

## Tests

```sh
npm test           # 44 tests: core + SSR + router + http, jsdom DOM tests,
                   # and a full SSR→hydrate→interact→navigate integration run
```

## Docs

| Guide | Covers |
| --- | --- |
| [Getting started](docs/getting-started.md) | install, first component, mental model |
| [Reactivity](docs/reactivity.md) | signal, computed, effect, batch, untrack |
| [Templates](docs/templates.md) | attributes, events, `bind`, `ref`, lists, conditionals |
| [Routing & guards](docs/routing.md) | routes, params, guards, redirects, the `view` outlet |
| [HTTP](docs/http.md) | requests, interceptors, error handling |
| [SSR & hydration](docs/ssr.md) | renderToString, state transfer, how hydration works |

## Project layout

```
src/            the framework (six files, ~700 lines, extensively commented)
examples/demo/  full SSR demo app (server, pages, store, styles)
docs/           the guides above
test/           unit + DOM + integration suites
```

## Philosophy

Every byte earns its place. Liteon ships the 20% of a big framework that 95% of apps use — reactivity, templating, routing, data fetching, SSR — and implements it in code small enough to read in an afternoon. When you outgrow it, you'll understand exactly what you're migrating away from, because none of it was magic.
