/**
 * liteon/http — tiny fetch wrapper.
 *
 * const api = createHttp({ baseURL: '/api' });
 * const users = await api.get('/users');            // JSON parsed
 * await api.post('/users', { name: 'Amira' });      // JSON body + header
 *
 * api.interceptors.request.use(cfg => { cfg.headers.authorization = t; });
 * api.interceptors.response.use((res, cfg) => res);
 *
 * Non-2xx responses throw HttpError { status, body, response }.
 * Works in the browser and in Node 18+ (native fetch).
 */

export class HttpError extends Error {
  constructor(response, body) {
    super(`HTTP ${response.status} ${response.statusText || ''}`.trim());
    this.name = 'HttpError';
    this.status = response.status;
    this.body = body;
    this.response = response;
  }
}

export function createHttp({ baseURL = '', headers = {}, fetch: fetchImpl } = {}) {
  const requestInterceptors = [];
  const responseInterceptors = [];
  const doFetch = fetchImpl || ((...args) => fetch(...args));

  async function request(method, url, { body, headers: extra, ...rest } = {}) {
    let config = {
      method,
      url: baseURL + url,
      headers: { ...headers, ...extra },
      body,
      ...rest,
    };
    for (const fn of requestInterceptors) config = (await fn(config)) || config;

    const init = { method: config.method, headers: { ...config.headers }, ...rest };
    if (config.body !== undefined) {
      const raw =
        typeof config.body === 'string' ||
        (typeof FormData !== 'undefined' && config.body instanceof FormData) ||
        (typeof Blob !== 'undefined' && config.body instanceof Blob);
      if (raw) {
        init.body = config.body;
      } else {
        init.body = JSON.stringify(config.body);
        init.headers['content-type'] = init.headers['content-type'] || 'application/json';
      }
    }

    let response = await doFetch(config.url, init);
    for (const fn of responseInterceptors) response = (await fn(response, config)) || response;

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) throw new HttpError(response, data);
    return data;
  }

  const api = {
    request,
    interceptors: {
      request: { use: (fn) => requestInterceptors.push(fn) },
      response: { use: (fn) => responseInterceptors.push(fn) },
    },
  };
  for (const m of ['get', 'delete', 'head']) {
    api[m] = (url, options) => request(m.toUpperCase(), url, options);
  }
  for (const m of ['post', 'put', 'patch']) {
    api[m] = (url, body, options) => request(m.toUpperCase(), url, { ...options, body });
  }
  return api;
}

export const http = createHttp();
