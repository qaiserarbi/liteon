import { html } from 'liteon';
import { users, usersError, loadUsers, search, filteredUsers } from '../store.js';

export function Users() {
  // On first server render the data was loaded before rendering; on a
  // client-side navigation this fetches it once from /api/users.
  if (typeof window !== 'undefined') loadUsers();

  return html`
    <section>
      <h1>Team directory</h1>
      <p class="lede">
        A JSON response from <code>/api/users</code>, mapped straight into HTML.
        The search box is two-way bound to a signal; the list below is a
        <code>computed()</code> that filters as you type.
      </p>

      <input
        class="search"
        bind=${search}
        placeholder="Filter by name or team…"
        aria-label="Filter users"
      />

      ${() => {
        if (usersError.value) return html`<p class="error">Couldn't load users: ${usersError.value}</p>`;
        if (!users.value) return html`<p class="muted">Loading…</p>`;
        const list = filteredUsers.value;
        if (list.length === 0) return html`<p class="muted">No one matches that filter.</p>`;
        return html`
          <ul class="user-list">
            ${list.map(
              (u) => html`
                <li class="user">
                  <span class="avatar" aria-hidden="true">${u.name[0]}</span>
                  <span class="user-name">${u.name}</span>
                  <span class="muted">${u.email}</span>
                  <span class="tag">${u.role}</span>
                </li>
              `
            )}
          </ul>
        `;
      }}
    </section>
  `;
}
