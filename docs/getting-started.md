# Getting started

## Install

```sh
npm install liteon
```

Or skip npm entirely — liteon is plain ES modules with zero dependencies, so you can vendor `src/` and import it directly in the browser:

```html
<script type="module">
  import { signal, html, render } from '/liteon/index.js';
</script>
```

There is no compiler, no bundler requirement, and no build step. (Bundling and minifying for production is still a good idea — the whole framework is 4.3 KB min+gzip.)

## Your first component

A component in liteon is just a function that returns a template:

```js
import { signal, html, render } from 'liteon';

function Counter() {
  const count = signal(0);
  return html`
    <button onclick=${() => count.value++}>
      Clicked ${count} times
    </button>
  `;
}

render(Counter(), document.getElementById('app'));
```

Three things to notice:

1. **State is a `signal`.** Read it with `.value` (inside templates you can pass the signal itself). Write it with `.value =`. Anything reading a signal automatically re-runs when it changes.
2. **The template is real HTML** in a tagged template literal. `${...}` slots hold text, other templates, arrays, event handlers, or attribute values.
3. **`render` mounts once.** After that there are no re-renders of the component — when `count` changes, liteon updates the single text node that displays it. The function `Counter()` runs exactly once.

## The mental model

If you're coming from React: components are *not* re-executed on state change. There is no reconciliation, no `useMemo`, no dependency arrays. A component function is a constructor that runs once and wires signals to DOM nodes. Reactivity lives in the *values*, not in the component.

If you're coming from Vue or Solid: you'll feel at home. `signal` ≈ `ref`, `computed` is `computed`, templates bind fine-grained.

## Next steps

- [Reactivity](reactivity.md) — the four primitives and when to use each
- [Templates](templates.md) — everything `html` can do
- [SSR & hydration](ssr.md) — take the same components server-side
