/**
 * liteon/router — isomorphic router with guards.
 *
 * const router = createRouter({
 *   routes: [
 *     { path: '/',          component: Home },
 *     { path: '/users/:id', component: User },
 *     { path: '/admin',     component: Admin, guards: [requireAuth] },
 *     { path: '*',          component: NotFound },
 *   ],
 *   guards: [logEveryNavigation],           // global guards (optional)
 * });
 *
 * A guard is (ctx) => true | false | '/redirect' (may be async).
 * ctx = { to, from, params, query, server }  — `server` carries request
 * context (e.g. cookies) when guards run during SSR.
 *
 * Browser:  router.start()            intercept links, popstate, initial route
 *           router.navigate('/path')  programmatic navigation (guards run)
 *           ${router.view}            reactive outlet inside a template
 * Server:   await router.resolve(url, serverCtx)
 *           -> { status, location?, route, params, query, path }
 */

import { signal } from './reactive.js';
import { html } from './template.js';

function compilePath(path) {
  if (path === '*') return { keys: [], regex: /^.*$/, wildcard: true };
  const keys = [];
  const pattern = path
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) {
        keys.push(seg.slice(1));
        return '([^/]+)';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { keys, regex: new RegExp(`^${pattern}/?$`), wildcard: false };
}

export function createRouter({ routes, guards = [] } = {}) {
  const table = routes.map((r) => ({ ...r, ...compilePath(r.path) }));
  const current = signal(null);

  function match(url) {
    const u = new URL(url, 'http://liteon.local');
    for (const r of table) {
      if (r.wildcard) continue;
      const m = r.regex.exec(u.pathname);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        return {
          route: r,
          params,
          path: u.pathname,
          query: Object.fromEntries(u.searchParams),
        };
      }
    }
    const fallback = table.find((r) => r.wildcard) || null;
    return { route: fallback, params: {}, path: u.pathname, query: Object.fromEntries(u.searchParams) };
  }

  async function runGuards(to, from, server) {
    const chain = [...guards, ...((to.route && to.route.guards) || [])];
    for (const guard of chain) {
      const result = await guard({ to, from, params: to.params, query: to.query, server });
      if (result === false) return { blocked: true };
      if (typeof result === 'string') return { redirect: result };
    }
    return { ok: true };
  }

  /* ------------------------------ browser ------------------------------ */

  async function navigate(path, { replace = false } = {}) {
    const from = current.peek();
    const to = match(path);
    const verdict = await runGuards(to, from);
    if (verdict.redirect) return navigate(verdict.redirect, { replace: true });
    if (verdict.blocked) return false;
    if (typeof history !== 'undefined') {
      history[replace ? 'replaceState' : 'pushState']({}, '', path);
    }
    current.value = to;
    return true;
  }

  function start() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a || a.target || a.hasAttribute('download') || a.hasAttribute('data-external')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('/')) return;
      e.preventDefault();
      navigate(href);
    });

    window.addEventListener('popstate', async () => {
      const from = current.peek();
      const to = match(location.href);
      const verdict = await runGuards(to, from);
      if (verdict.redirect) return navigate(verdict.redirect, { replace: true });
      if (verdict.blocked) {
        if (from) history.pushState({}, '', from.path);
        return;
      }
      current.value = to;
    });

    // The server already enforced guards for the initial page.
    current.value = match(location.href);
  }

  /* ------------------------------ server ------------------------------- */

  async function resolve(url, server = {}) {
    const to = match(url);
    const verdict = await runGuards(to, null, server);
    if (verdict.redirect) return { status: 302, location: verdict.redirect, ...to };
    if (verdict.blocked) return { status: 403, ...to };
    const status = to.route && !to.route.wildcard ? 200 : 404;
    return { status, ...to };
  }

  /** Set the active route (used on the server before renderToString). */
  function set(resolved) {
    current.value = resolved;
  }

  /* ------------------------------ outlet ------------------------------- */

  const view = () => {
    const c = current.value;
    if (!c || !c.route) return html`<p>Not found</p>`;
    return c.route.component({ params: c.params, query: c.query });
  };

  return { current, match, navigate, start, resolve, set, view };
}
