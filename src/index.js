/**
 * liteon — the lightest way to build for the web.
 *
 * import { signal, effect, computed, html, render, hydrate,
 *          createRouter, createHttp, http, getServerState } from 'liteon';
 *
 * Server-only helpers (renderToString, serializeState) live in
 * 'liteon/ssr' so the browser bundle never pays for them.
 */

export { signal, effect, computed, batch, untrack, isSignal } from './reactive.js';
export { html, isTemplate } from './template.js';
export { render, hydrate } from './dom.js';
export { createRouter } from './router.js';
export { createHttp, http, HttpError } from './http.js';

/** Read state serialized on the server with serializeState(). */
export function getServerState() {
  return typeof window !== 'undefined' ? window.__LITEON__ ?? null : null;
}
