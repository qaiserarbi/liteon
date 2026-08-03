/**
 * liteon/reactive — fine-grained reactivity core.
 *
 * signal(v)    -> { value, peek() }   read/write reactive container
 * computed(fn) -> { value, peek() }   derived read-only signal
 * effect(fn)   -> dispose()           re-runs fn when its dependencies change
 * batch(fn)                           group writes, flush effects once
 * untrack(fn)                         read signals without subscribing
 */

export const SIGNAL = Symbol('liteon.signal');

let activeEffect = null;
let batchDepth = 0;
const pendingEffects = new Set();

function notify(subscribers) {
  if (batchDepth > 0) {
    for (const e of subscribers) pendingEffects.add(e);
  } else {
    for (const e of [...subscribers]) e.run();
  }
}

function cleanup(e) {
  for (const subs of e.deps) subs.delete(e);
  e.deps.clear();
}

export function signal(initial) {
  let value = initial;
  const subscribers = new Set();
  return {
    [SIGNAL]: true,
    get value() {
      if (activeEffect) {
        subscribers.add(activeEffect);
        activeEffect.deps.add(subscribers);
      }
      return value;
    },
    set value(next) {
      if (Object.is(next, value)) return;
      value = next;
      notify(subscribers);
    },
    peek() {
      return value;
    },
  };
}

export function effect(fn) {
  const e = {
    deps: new Set(),
    disposed: false,
    run() {
      if (e.disposed) return;
      cleanup(e);
      const prev = activeEffect;
      activeEffect = e;
      try {
        fn();
      } finally {
        activeEffect = prev;
      }
    },
  };
  e.run();
  return () => {
    e.disposed = true;
    cleanup(e);
    pendingEffects.delete(e);
  };
}

export function computed(fn) {
  const out = signal(undefined);
  effect(() => {
    out.value = fn();
  });
  return {
    [SIGNAL]: true,
    get value() {
      return out.value;
    },
    peek() {
      return out.peek();
    },
  };
}

export function batch(fn) {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const run = [...pendingEffects];
      pendingEffects.clear();
      for (const e of run) e.run();
    }
  }
}

export function untrack(fn) {
  const prev = activeEffect;
  activeEffect = null;
  try {
    return fn();
  } finally {
    activeEffect = prev;
  }
}

export function isSignal(v) {
  return !!(v && v[SIGNAL]);
}
