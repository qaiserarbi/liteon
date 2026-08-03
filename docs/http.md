# HTTP

A `fetch` wrapper that removes the boilerplate: base URLs, JSON both ways, interceptors, and errors you can actually catch.

## Quick use

```js
import { http } from 'liteon';                 // default instance

const users = await http.get('/api/users');            // parsed JSON
const created = await http.post('/api/users', { name: 'Ada' }); // body auto-JSON'd
await http.delete('/api/users/7');
```

`get`, `delete`, `head` take `(url, options)`; `post`, `put`, `patch` take `(url, body, options)`. Responses with a JSON content-type are parsed; everything else returns text.

## Your own instance

```js
import { createHttp } from 'liteon';

export const api = createHttp({
  baseURL: 'https://api.example.com',
  headers: { 'x-app': 'liteon-demo' },
  // fetch: customFetchImpl   // e.g. for tests or Node < 18
});
```

## Bodies

Objects are `JSON.stringify`'d with `content-type: application/json` (unless you set one). Strings, `FormData`, and `Blob` pass through untouched:

```js
await api.post('/upload', formData);       // browser sets the multipart boundary
```

## Interceptors

```js
api.interceptors.request.use(async (config) => {
  config.headers.authorization = `Bearer ${await getToken()}`;
  return config;               // return the (new) config, or nothing to keep it
});

api.interceptors.response.use((response, config) => {
  if (response.status === 401) location.href = '/login';
  return response;
});
```

Request interceptors see `{ method, url, headers, body, ...options }` after `baseURL` is applied; response interceptors run before parsing.

## Errors

Non-2xx responses **throw** an `HttpError` with the parsed body attached:

```js
import { HttpError } from 'liteon';

try {
  await api.post('/api/login', creds);
} catch (err) {
  if (err instanceof HttpError) {
    console.log(err.status);        // 401
    console.log(err.body?.error);   // "bad credentials" — already parsed
    console.log(err.response);      // the raw Response
  } else throw err;                 // network failure etc.
}
```

## With signals

The idiomatic loading pattern:

```js
const users = signal(null);
const error = signal(null);

async function load() {
  try {
    users.value = await http.get('/api/users');
  } catch (e) {
    error.value = e.body?.error ?? e.message;
  }
}
```

```js
html`${() =>
  error.value ? html`<p class="error">${error.value}</p>`
  : users.value ? html`<ul>${users.value.map((u) => html`<li>${u.name}</li>`)}</ul>`
  : html`<p>Loading…</p>`}`
```

On the server, load data *before* rendering and transfer it with `serializeState` — see [SSR](ssr.md) — so the client never refetches what the server already had.
