/**
 * Type check exercise — compiled with `tsc --noEmit --strict`, never run.
 * If this file compiles, the declarations match how liteon is actually used.
 */
import {
  signal,
  computed,
  effect,
  batch,
  untrack,
  isSignal,
  html,
  render,
  hydrate,
  createRouter,
  createHttp,
  http,
  HttpError,
  getServerState,
  type Signal,
  type Template,
  type Guard,
} from '../src/index.js';
import { renderToString, serializeState } from '../src/ssr.js';

/* ------------------------------ reactive ------------------------------ */

const count = signal(0);
const label: Signal<string> = signal('items');
const total = computed(() => count.value * 2);
const t: number = total.value;
count.value = t;
count.peek().toFixed(1);

// @ts-expect-error — computed is read-only
total.value = 5;

const stop = effect(() => {
  console.log(count.value, untrack(() => label.value));
});
stop();

const sum: number = batch(() => {
  count.value = 1;
  return count.peek() + 1;
});
console.log(sum);

const maybe: unknown = count;
if (isSignal(maybe)) maybe.peek();

/* ------------------------------ templates ----------------------------- */

const busy = signal(false);
const name = signal('');

function Row(user: { id: number; name: string }): Template {
  return html`<li onclick=${() => console.log(user.id)}>${user.name}</li>`;
}

const tpl: Template = html`
  <section class=${() => (busy.value ? 'busy' : '')}>
    <input bind=${name} placeholder="name" />
    <button disabled=${busy} onclick=${(e: MouseEvent) => e.preventDefault()}>go</button>
    ${() => (name.value ? html`<p>hi ${name}</p>` : null)}
    <ul>${[{ id: 1, name: 'Ada' }].map(Row)}</ul>
    plain ${1} and ${true} and ${undefined}
  </section>
`;

declare const container: Element;
const disposeRender: () => void = render(tpl, container);
disposeRender();
const disposeHydrate: () => void = hydrate(tpl, container);
disposeHydrate();

/* ------------------------------- router ------------------------------- */

interface ServerCtx {
  cookies: Record<string, string>;
}

const requireAuth: Guard<ServerCtx> = ({ server, to }) =>
  server ? !!server.cookies.session : `/login?next=${encodeURIComponent(to.path)}`;

const router = createRouter({
  guards: [() => true],
  routes: [
    { path: '/', component: () => html`<h1>home</h1>`, title: 'Home' },
    {
      path: '/users/:id',
      component: ({ params, query }) => html`<p>${params.id} ${query.tab ?? ''}</p>`,
    },
    { path: '/admin', component: () => html`<p>hi</p>`, guards: [requireAuth as Guard] },
    { path: '*', component: () => html`<p>404</p>` },
  ],
});

router.start();
const outlet: Template = html`<main>${router.view}</main>`;
console.log(outlet);

const path: string | undefined = router.current.value?.path;
console.log(path);

async function serverSide(): Promise<void> {
  const ok: boolean = await router.navigate('/users/7', { replace: true });
  console.log(ok);
  const resolved = await router.resolve<ServerCtx>('/admin', { cookies: {} });
  if (resolved.status === 302) console.log(resolved.location);
  router.set(resolved);
}
void serverSide();

/* -------------------------------- http -------------------------------- */

interface User {
  id: number;
  name: string;
}

const api = createHttp({ baseURL: '/api', headers: { 'x-app': 'demo' } });
api.interceptors.request.use((config) => {
  config.headers.authorization = 'Bearer token';
  return config;
});
api.interceptors.response.use((response) => response);

async function fetchUsers(): Promise<void> {
  const users = await api.get<User[]>('/users');
  users[0]?.name.toUpperCase();
  const created = await api.post<User>('/users', { name: 'Ada' });
  console.log(created.id);
  await http.delete('/users/1');
  try {
    await api.get('/missing');
  } catch (err) {
    if (err instanceof HttpError) {
      const s: number = err.status;
      console.log(s, err.body, err.response.status);
    }
  }
}
void fetchUsers();

/* --------------------------------- ssr -------------------------------- */

const page: string = renderToString(tpl);
const stateTag: string = serializeState({ users: [], kb: 4.3 });
console.log(page.length + stateTag.length);

interface AppState {
  users: User[] | null;
}
const state = getServerState<AppState>();
state?.users?.map((u) => u.name);
