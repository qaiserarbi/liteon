import { html } from 'liteon';
import { auth, users } from '../store.js';

export function Dashboard() {
  return html`
    <section>
      <h1>Dashboard</h1>
      <p class="lede">
        You only got here because the <code>requireAuth</code> guard let you
        through. Logged out, the server answers this URL with a
        <code>302 → /login</code>; on the client, navigation is intercepted
        before this page ever renders.
      </p>
      <div class="card">
        <h2>Welcome, ${() => auth.user.value?.name || 'stranger'}</h2>
        <p>
          Your session is a cookie the server checks in the guard during SSR,
          mirrored by an <code>auth.user</code> signal the same guard checks in
          the browser. One guard, two runtimes.
        </p>
        <p class="muted">
          Team members on record:
          ${() => (users.value ? users.value.length : '—')}
        </p>
      </div>
    </section>
  `;
}

export function NotFound() {
  return html`
    <section class="card narrow">
      <h1>404</h1>
      <p>That route isn't in the table. <a href="/">Head home</a>.</p>
    </section>
  `;
}
