/**
 * Integration test: server-render the real demo App, hydrate it in jsdom,
 * then interact (counter clicks) and navigate client-side through a guard.
 */
import { JSDOM } from 'jsdom';
import { renderToString, serializeState } from '../src/ssr.js';

// ---- 1. Simulate the server request for "/" --------------------------------
const { router, App } = await import('../examples/demo/app/app.js');
const store = await import('../examples/demo/app/store.js');

const resolution = await router.resolve('/', { cookies: {} });
if (resolution.status !== 200) throw new Error('expected 200 for /');
router.set(resolution); // what the demo server does before rendering

const bodyHtml = renderToString(App());
const stateScript = serializeState({ user: null, users: null, kb: '2.1' });

const page = `<!doctype html><html><head><title>t</title></head><body>
<div id="app">${bodyHtml}</div>
${stateScript}
</body></html>`;

// ---- 2. Boot a jsdom "browser" over that HTML ------------------------------
const dom = new JSDOM(page, { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.history = dom.window.history;
global.location = dom.window.location;
global.CustomEvent = dom.window.CustomEvent;

// Fresh module graph so client-side init re-runs inside jsdom
const bust = `?client=${Date.now()}`;
const { hydrate } = await import(`../src/dom.js${bust}`);
const appMod = await import(`../examples/demo/app/app.js${bust}`);

const container = document.getElementById('app');
const h1Before = container.querySelector('h1');

appMod.router.start();
hydrate(appMod.App(), container);

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ok ', name); }
  else { fail++; console.log('  FAIL', name); }
}

// ---- 3. Static DOM must be reused, not replaced ----------------------------
const h1After = container.querySelector('h1');
check('static h1 reused by hydration', h1Before && h1Before === h1After);

// ---- 4. Interactivity: counter button --------------------------------------
const btn = [...container.querySelectorAll('button')].find(b => b.textContent.trim() === '+');
check('counter button found', !!btn);
const stat = container.querySelector('.stat');
if (btn && stat) {
  btn.click(); btn.click(); btn.click();
  await Promise.resolve();
  check('counter reacts to clicks (3)', stat.textContent === '3');
}

// ---- 5. Client-side navigation through a guard ------------------------------
await appMod.router.navigate('/dashboard'); // not authed -> /login?next=...
await new Promise(r => setTimeout(r, 10));
check('guard redirected to /login', location.pathname === '/login');
check('login form rendered', !!container.querySelector('input'));

await appMod.router.navigate('/users');
await new Promise(r => setTimeout(r, 10));
check('navigated to /users', location.pathname === '/users');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
