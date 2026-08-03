import { html, signal } from 'liteon';
import { auth } from '../store.js';
import { router } from '../app.js';

export function Login({ query }) {
  const username = signal('');
  const password = signal('');
  const error = signal('');
  const busy = signal(false);

  async function submit() {
    if (!username.peek().trim()) {
      error.value = 'Enter a username — any name works in this demo.';
      return;
    }
    busy.value = true;
    error.value = '';
    try {
      await auth.login(username.peek(), password.peek());
      router.navigate(query.next || '/dashboard');
    } catch (err) {
      error.value = err.body?.error || err.message;
    } finally {
      busy.value = false;
    }
  }

  return html`
    <section class="card narrow">
      <h1>Sign in</h1>
      <p class="muted">
        Any username and password work — this demo only cares that you're
        "someone", so the <code>requireAuth</code> guard lets you through.
      </p>
      <label>
        Username
        <input bind=${username} placeholder="e.g. amira" autocomplete="username" />
      </label>
      <label>
        Password
        <input bind=${password} type="password" placeholder="anything" autocomplete="current-password" />
      </label>
      ${() => (error.value ? html`<p class="error">${error.value}</p>` : null)}
      <button class="btn primary" disabled=${busy} onclick=${submit}>
        ${() => (busy.value ? 'Signing in…' : 'Sign in')}
      </button>
    </section>
  `;
}
