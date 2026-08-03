# Templates

`html` is a tagged template literal. It parses nothing at call time — it just captures the strings and values. `render`, `hydrate`, or `renderToString` do the work.

```js
import { html, render } from 'liteon';
render(html`<h1>Hello ${name}</h1>`, container);
```

The static parts are parsed by the browser **once per template shape** (into a cached `<template>`), then cloned per instance. Dynamic slots are bound directly to the nodes they control.

## Child slots (between tags)

A `${...}` between tags accepts:

| Value | Renders as |
| --- | --- |
| string / number | text (always escaped — safe by default) |
| `signal` / `computed` | live text, updates in place |
| `() => ...` function | live region, re-renders when signals it reads change |
| another `html\`\`` template | nested component |
| array | each item in order (great with `.map()`) |
| `null` / `undefined` / `false` / `true` | nothing |

## Conditionals

Plain JavaScript — wrap in a function to make it live:

```js
${() => (error.value ? html`<p class="error">${error.value}</p>` : null)}
```

## Lists

```js
const users = signal([]);

html`<ul>
  ${() => users.value.map((u) => html`<li>${u.name} — ${u.email}</li>`)}
</ul>`
```

When `users` changes the region re-renders. (Liteon v0.1 replaces the region's content rather than keyed-diffing; for the list sizes a 4 KB framework is aimed at, this is consistently fast.)

## Attributes

An expression inside a tag must be the **entire attribute value**:

```js
html`<a href=${url} class=${() => (active.value ? 'active' : '')}>Home</a>`
```

- Static values are set once; signals and functions become live.
- `false` / `null` / `undefined` removes the attribute; `true` sets it empty (`disabled`).
- `value`, `checked`, `disabled`, `selected` are set as *properties*, so form controls behave.

```js
html`<button disabled=${busy}>Save</button>` // busy is a signal
```

Partial interpolation like `class="btn ${kind}"` is not supported — compose the string in the expression instead: `class=${`btn ${kind}`}`.

## Events: `on<event>=${fn}`

```js
html`<button onclick=${() => count.value++}>+</button>
     <form onsubmit=${(e) => { e.preventDefault(); save(); }}>…</form>`
```

Any DOM event works: `oninput`, `onkeydown`, `onchange`… The listener is attached with `addEventListener` — it is never serialized, so SSR output stays clean.

## Two-way binding: `bind=${signal}`

```js
const query = signal('');
html`<input bind=${query} placeholder="search" />`
```

- Signal → element: the input's `value` follows the signal.
- Element → signal: typing writes back on `input`.
- Checkboxes bind `checked` to a boolean signal automatically.

`bind` on the server renders the current value into the HTML, so forms are pre-filled before hydration.

## Element refs: `ref=${fn}`

Called with the element as soon as it's created — for focus, measurements, third-party libs:

```js
html`<input ref=${(el) => el.focus()} />`
```

## Composition

Components are functions returning templates. Compose by interpolation:

```js
function Layout(page) {
  return html`<div class="shell">${Header()} <main>${page}</main></div>`;
}
```

No props system, no context API — it's JavaScript; pass arguments, share signals via modules.
