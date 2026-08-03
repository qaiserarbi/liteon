/**
 * DOM + hydration tests using jsdom — node test/dom.js
 */

import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;

const { signal, computed } = await import('../src/reactive.js');
const { html } = await import('../src/template.js');
const { render, hydrate } = await import('../src/dom.js');
const { renderToString } = await import('../src/ssr.js');

let passed = 0;
function test(name, fn) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  try {
    fn(el);
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}\n${err.stack}`);
    process.exitCode = 1;
  } finally {
    el.remove();
  }
}

const text = (el) => el.textContent.trim();

/* ------------------------------ render ------------------------------- */

test('renders static markup', (el) => {
  render(html`<p class="a">hello</p>`, el);
  assert.equal(el.querySelector('p.a').textContent, 'hello');
});

test('signal in text updates only that node', (el) => {
  const n = signal(1);
  render(html`<span>${n}</span>`, el);
  assert.equal(text(el), '1');
  n.value = 42;
  assert.equal(text(el), '42');
});

test('function expressions are reactive', (el) => {
  const n = signal(2);
  render(html`<span>${() => n.value * 10}</span>`, el);
  assert.equal(text(el), '20');
  n.value = 3;
  assert.equal(text(el), '30');
});

test('event listeners fire and drive signals', (el) => {
  const n = signal(0);
  render(html`<button onclick=${() => n.value++}>+</button><b>${n}</b>`, el);
  el.querySelector('button').click();
  el.querySelector('button').click();
  assert.equal(el.querySelector('b').textContent, '2');
});

test('two-way bind: signal -> input and input -> signal', (el) => {
  const name = signal('ada');
  render(html`<input bind=${name} /><span>${name}</span>`, el);
  const input = el.querySelector('input');
  assert.equal(input.value, 'ada');
  name.value = 'grace';
  assert.equal(input.value, 'grace');
  input.value = 'lin';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(name.peek(), 'lin');
  assert.equal(el.querySelector('span').textContent, 'lin');
});

test('reactive attribute set and removed', (el) => {
  const cls = signal('on');
  render(html`<div id="t" class=${cls}></div>`, el);
  const t = el.querySelector('#t');
  assert.equal(t.getAttribute('class'), 'on');
  cls.value = null;
  assert.equal(t.hasAttribute('class'), false);
});

test('list from JSON re-renders on change', (el) => {
  const items = signal([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
  render(html`<ul>${() => items.value.map((i) => html`<li>${i.name}</li>`)}</ul>`, el);
  assert.equal(el.querySelectorAll('li').length, 2);
  items.value = [...items.peek(), { id: 3, name: 'c' }];
  assert.equal(el.querySelectorAll('li').length, 3);
  assert.equal(el.querySelectorAll('li')[2].textContent, 'c');
});

test('conditional regions swap templates', (el) => {
  const on = signal(false);
  render(html`<div>${() => (on.value ? html`<b>yes</b>` : html`<i>no</i>`)}</div>`, el);
  assert.ok(el.querySelector('i'));
  on.value = true;
  assert.ok(el.querySelector('b'));
  assert.equal(el.querySelector('i'), null);
});

test('nested component functions compose', (el) => {
  const Badge = (label) => html`<em class="badge">${label}</em>`;
  render(html`<p>status: ${Badge('ok')}</p>`, el);
  assert.equal(el.querySelector('em.badge').textContent, 'ok');
});

/* ----------------------------- hydration ----------------------------- */

test('hydrate reuses server DOM and attaches listeners', (el) => {
  const count = signal(5);
  const view = () =>
    html`<div class="shell"><h1>Counter</h1><button onclick=${() => count.value++}>+</button><output>${count}</output></div>`;

  el.innerHTML = renderToString(view());
  const staticH1 = el.querySelector('h1');
  const staticBtn = el.querySelector('button');

  hydrate(view(), el);

  // Static shell reused — the exact same element objects.
  assert.equal(el.querySelector('h1'), staticH1);
  assert.equal(el.querySelector('button'), staticBtn);

  assert.equal(el.querySelector('output').textContent.trim(), '5');
  staticBtn.click();
  assert.equal(el.querySelector('output').textContent.trim(), '6');
});

test('hydrate wires two-way bind on SSR input', (el) => {
  const q = signal('tea');
  const view = () => html`<label>Search <input bind=${q} /></label><p>${q}</p>`;
  el.innerHTML = renderToString(view());
  assert.equal(el.querySelector('input').getAttribute('value'), 'tea');

  hydrate(view(), el);
  const input = el.querySelector('input');
  input.value = 'coffee';
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(text(el.querySelector('p')), 'coffee');
});

test('hydrate handles nested templates and lists in regions', (el) => {
  const items = signal(['a', 'b']);
  const view = () => html`<section><h2>List</h2><ul>${() => items.value.map((i) => html`<li>${i}</li>`)}</ul></section>`;
  el.innerHTML = renderToString(view());
  hydrate(view(), el);
  assert.equal(el.querySelectorAll('li').length, 2);
  items.value = ['a', 'b', 'c'];
  assert.equal(el.querySelectorAll('li').length, 3);
});

test('hydrate keeps sibling regions aligned', (el) => {
  const a = signal('A');
  const b = signal('B');
  const view = () => html`<p>${a}</p><p>${b}</p><footer>end</footer>`;
  el.innerHTML = renderToString(view());
  const footer = el.querySelector('footer');
  hydrate(view(), el);
  assert.equal(el.querySelector('footer'), footer); // static node reused
  b.value = 'B2';
  assert.equal(el.querySelectorAll('p')[1].textContent.trim(), 'B2');
  assert.equal(el.querySelectorAll('p')[0].textContent.trim(), 'A');
});


// Regression: a child region BEFORE a sibling element with dynamic attrs
// used to shift recorded paths (replaceWith turns 1 comment into 2 nodes).
test('child region before sibling with dynamic attrs', (el) => {
  const err = signal('');
  const busy = signal(false);
  render(html`<section>
    ${() => (err.value ? html`<p class="error">${err.value}</p>` : null)}
    <button disabled=${busy}>Go</button>
  </section>`, el);
  const btn = el.querySelector('button');
  assert.equal(btn.textContent, 'Go');
  busy.value = true;
  assert.equal(btn.disabled, true);
  err.value = 'oops';
  assert.ok(el.querySelector('.error'));
});

console.log(`\n${passed} DOM tests passed${process.exitCode ? ' (with failures)' : ''}`);
