# Reactivity

Liteon's core is ~90 lines: four primitives with automatic dependency tracking.

## `signal(initial)`

A reactive container. Reading `.value` inside an effect (or a template) subscribes; writing `.value` notifies subscribers.

```js
const name = signal('Ada');
name.value;          // read (tracks, if inside an effect)
name.value = 'Grace'; // write (notifies)
name.peek();          // read WITHOUT tracking
```

Writes are skipped when the new value is identical (`Object.is`), so `count.value = count.peek()` never triggers anything.

Use `peek()` in event handlers or guards when you want the current value but no subscription:

```js
async function submit() {
  await auth.login(username.peek(), password.peek()); // no tracking needed
}
```

## `effect(fn)`

Runs `fn` immediately, tracks every signal it reads, and re-runs it whenever any of them change. Dependencies are re-collected on every run, so conditional reads work correctly:

```js
const stop = effect(() => {
  if (loggedIn.value) console.log(`hi ${user.value.name}`); // user tracked only while logged in
});

stop(); // dispose: never runs again
```

`render`/`hydrate` create effects internally for every dynamic template slot — you rarely write `effect` by hand except for side effects like syncing `document.title`:

```js
effect(() => {
  document.title = route.value?.title ?? 'liteon';
});
```

## `computed(fn)`

A read-only signal derived from other signals:

```js
const items = signal([1, 2, 3]);
const total = computed(() => items.value.reduce((a, b) => a + b, 0));
total.value;  // 6 — recomputes only when items changes
```

Computeds are eager (they update when dependencies change, not when read) and can be used anywhere a signal can: templates, other computeds, effects.

## `batch(fn)`

Group several writes into one notification pass. Effects that depend on multiple written signals run once instead of once per write:

```js
batch(() => {
  firstName.value = 'Grace';
  lastName.value = 'Hopper';
}); // effects reading both run exactly once
```

## `untrack(fn)`

Read signals inside an effect *without* subscribing to them:

```js
effect(() => {
  console.log(trigger.value, untrack(() => noisy.value)); // re-runs only on trigger
});
```

## `isSignal(v)`

`true` when `v` is a signal or computed. Templates use it internally to decide how to bind a value.

## How tracking works (for the curious)

There is a single module-level `activeEffect`. Running an effect sets it; reading a signal while it's set records a two-way link (signal → effect for notification, effect → signal for cleanup). Before each re-run the effect unsubscribes from everything, so the dependency set always mirrors the *last* execution — no stale subscriptions, no manual dependency lists.
