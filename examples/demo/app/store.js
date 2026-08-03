/**
 * demo/store — shared reactive state.
 *
 * On the client, signals initialize from the state the server embedded
 * with serializeState(), so data fetched during SSR is never refetched.
 */

import { signal, computed, createHttp, getServerState } from './liteon.js';

const initial = getServerState() || {};

export const http = createHttp({ baseURL: '/api' });

/* ------------------------------- auth -------------------------------- */

export const auth = {
  user: signal(initial.user || null),

  async login(username, password) {
    const res = await http.post('/login', { username, password });
    auth.user.value = res.user;
    return res.user;
  },

  async logout() {
    await http.post('/logout');
    auth.user.value = null;
  },
};

/* ------------------------------- users ------------------------------- */

export const users = signal(initial.users || null);
export const usersError = signal(null);

export async function loadUsers() {
  if (users.peek()) return;
  try {
    users.value = await http.get('/users');
  } catch (err) {
    usersError.value = err.message;
  }
}

/* Two-way-bound search box + derived filtered list (see users page). */
export const search = signal('');

export const filteredUsers = computed(() => {
  const list = users.value || [];
  const q = search.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (u) => u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
  );
});

/* Injected by the server: the framework's real gzipped size in KB. */
export const frameworkKb = signal(initial.kb || null);
