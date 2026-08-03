import { html, signal, computed } from 'liteon';
import { frameworkKb } from '../store.js';

export function Home() {
  const count = signal(0);
  const doubled = computed(() => count.value * 2);
  const name = signal('');

  return html`
    <section class="hero">
      <p class="eyebrow">signals · ssr · routing · guards · http</p>
      <h1>The lightest way<br />to build for the web.</h1>
      <p class="lede">
        This page was rendered on the server, hydrated in place, and is now fully
        reactive — powered by
        ${() => (frameworkKb.value ? `${frameworkKb.value} KB` : 'a few KB')}
        of framework, measured live from this server's own source.
      </p>
    </section>

    <section class="card">
      <h2>Fine-grained reactivity</h2>
      <p>
        A signal updates exactly the DOM nodes that read it — no virtual DOM, no
        diffing, no re-render of this component.
      </p>
      <div class="row">
        <button class="btn" onclick=${() => count.value--}>−</button>
        <span class="stat">${count}</span>
        <button class="btn" onclick=${() => count.value++}>+</button>
        <span class="muted">doubled: ${doubled}</span>
      </div>
    </section>

    <section class="card">
      <h2>Two-way binding</h2>
      <p>
        <code>bind=\${signal}</code> keeps an input and a signal in sync — under
        10 lines of framework code.
      </p>
      <div class="row">
        <input bind=${name} placeholder="Type your name" aria-label="Your name" />
        <span>${() => (name.value ? `Hello, ${name.value}!` : 'Waiting for keystrokes…')}</span>
      </div>
    </section>

    <section class="card">
      <h2>Try the rest</h2>
      <p>
        <a href="/users">Users</a> renders a JSON API response into HTML —
        fetched on the server, hydrated without a duplicate request.
        <a href="/dashboard">Dashboard</a> is protected by a route guard: visit it
        logged out and the guard redirects you to login, on the server (HTTP 302)
        and on the client alike.
      </p>
    </section>
  `;
}
