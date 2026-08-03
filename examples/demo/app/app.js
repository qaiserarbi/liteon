/**
 * demo/app — routes, guards, and the app layout.
 * This module runs unchanged on the server and in the browser.
 */

import { html, createRouter } from './liteon.js';
import { auth, frameworkKb } from './store.js';
import { Home } from './pages/home.js';
import { Users } from './pages/users.js';
import { Login } from './pages/login.js';
import { Dashboard, NotFound } from './pages/dashboard.js';

/* ------------------------------- guards ------------------------------ */

/**
 * One guard, two runtimes. During SSR `server` carries the request's
 * cookies; in the browser we consult the auth signal.
 */
export function requireAuth({ server, to }) {
  const authed = server ? !!server.cookies?.liteon_user : !!auth.user.peek();
  return authed ? true : `/login?next=${encodeURIComponent(to.path)}`;
}

/** Logged-in visitors don't need the login page. */
export function skipIfAuthed({ server }) {
  const authed = server ? !!server.cookies?.liteon_user : !!auth.user.peek();
  return authed ? '/dashboard' : true;
}

/* ------------------------------- router ------------------------------ */

export const router = createRouter({
  routes: [
    { path: '/', component: Home, title: 'Liteon — the lightest framework' },
    { path: '/users', component: Users, title: 'Users · Liteon', load: 'users' },
    { path: '/login', component: Login, title: 'Sign in · Liteon', guards: [skipIfAuthed] },
    { path: '/dashboard', component: Dashboard, title: 'Dashboard · Liteon', guards: [requireAuth] },
    { path: '*', component: NotFound, title: 'Not found · Liteon' },
  ],
});

/* ------------------------------- layout ------------------------------ */

function navLink(href, label) {
  return html`<a
    href=${href}
    class=${() => (router.current.value?.path === href ? 'active' : '')}
    >${label}</a
  >`;
}

async function logout() {
  await auth.logout();
  router.navigate('/');
}

export function App() {
  return html`
    <div class="shell">
      <header class="top">
        <a href="/" class="brand">liteon<span class="cursor">_</span></a>
        <nav aria-label="Main">
          ${navLink('/users', 'Users')} ${navLink('/dashboard', 'Dashboard')}
          ${() =>
            auth.user.value
              ? html`<button class="btn ghost" onclick=${logout}>
                  Sign out (${auth.user.value.name})
                </button>`
              : navLink('/login', 'Sign in')}
        </nav>
      </header>
      <main id="main">${router.view}</main>
      <footer class="foot">
        <span
          >framework weight:
          ${() => (frameworkKb.value ? `${frameworkKb.value} KB gzipped` : '…')}</span
        >
        <span class="muted">rendered on the server · hydrated in your browser</span>
      </footer>
    </div>
  `;
}
