/**
 * Type definitions for liteon — the runtime stays plain JavaScript;
 * these declarations give TypeScript (and JS editors) full typing.
 */

/* ------------------------------ reactive ------------------------------ */

/** A writable reactive container. Read `.value` to track, write to notify. */
export interface Signal<T> {
  value: T;
  /** Read the current value WITHOUT subscribing. */
  peek(): T;
}

/** A read-only derived signal, created with `computed()`. */
export interface ReadonlySignal<T> {
  readonly value: T;
  peek(): T;
}

export function signal<T>(initial: T): Signal<T>;
export function signal<T = undefined>(): Signal<T | undefined>;

export function computed<T>(fn: () => T): ReadonlySignal<T>;

/**
 * Runs `fn` now and re-runs it whenever any signal it read changes.
 * Returns a disposer that stops it permanently.
 */
export function effect(fn: () => void): () => void;

/** Group writes; effects depending on several of them flush once. */
export function batch<T>(fn: () => T): T;

/** Read signals inside an effect without subscribing to them. */
export function untrack<T>(fn: () => T): T;

export function isSignal(v: unknown): v is Signal<unknown>;

/* ------------------------------ templates ----------------------------- */

/** The result of the html`` tag. Opaque; pass it to render/hydrate/renderToString. */
export interface Template {
  strings: TemplateStringsArray;
  values: unknown[];
}

/**
 * Anything a child `${slot}` accepts: text, signals, functions,
 * nested templates, arrays of any of these, or nothing.
 */
export type Child =
  | string
  | number
  | boolean
  | null
  | undefined
  | Template
  | Signal<unknown>
  | ReadonlySignal<unknown>
  | Node
  | (() => Child)
  | Child[];

/**
 * Attribute `${slots}` additionally accept event listeners
 * (`onclick=${fn}`), signals to two-way bind (`bind=${sig}`),
 * and element refs (`ref=${fn}`).
 */
export type AttrValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Signal<unknown>
  | ReadonlySignal<unknown>
  | ((...args: never[]) => unknown);

export function html(
  strings: TemplateStringsArray,
  ...values: Array<Child | AttrValue>
): Template;

export function isTemplate(v: unknown): v is Template;

/** Mount a template into a container (clears it first). Returns a disposer. */
export function render(result: Template, container: Element): () => void;

/**
 * Reuse server-rendered DOM in `container`, attaching listeners and
 * reactive bindings. Mismatched regions re-render; returns a disposer.
 */
export function hydrate(result: Template, container: Element): () => void;

/* ------------------------------- router ------------------------------- */

export interface RouteComponentContext {
  params: Record<string, string>;
  query: Record<string, string>;
}

export interface Route {
  /** '/users/:id', '*' for the fallback. */
  path: string;
  component: (ctx: RouteComponentContext) => Template;
  guards?: Guard[];
  /** Extra fields (title, load, …) ride along on the matched route. */
  [extra: string]: unknown;
}

export interface RouteMatch {
  route: (Route & { wildcard: boolean }) | null;
  params: Record<string, string>;
  query: Record<string, string>;
  path: string;
}

export interface GuardContext<S = unknown> {
  to: RouteMatch;
  from: RouteMatch | null;
  params: Record<string, string>;
  query: Record<string, string>;
  /** Present only during server-side resolve(); whatever you passed in. */
  server?: S;
}

/** Return true to pass, false to block (403), or '/path' to redirect (302). */
export type Guard<S = unknown> = (
  ctx: GuardContext<S>
) => boolean | string | Promise<boolean | string>;

export interface ResolvedRoute extends RouteMatch {
  /** 200, 302 (with location), 403, or 404. */
  status: number;
  location?: string;
}

export interface Router {
  /** Reactive current route; null until start()/set(). */
  current: Signal<RouteMatch | null>;
  match(url: string): RouteMatch;
  /** Run guards and navigate. Resolves false if a guard blocked. */
  navigate(path: string, options?: { replace?: boolean }): Promise<boolean>;
  /** Browser: intercept link clicks + popstate, set the initial route. */
  start(): void;
  /** Server: run guards for a request URL. */
  resolve<S = unknown>(url: string, server?: S): Promise<ResolvedRoute>;
  /** Server: make a resolved route current before renderToString(). */
  set(resolved: RouteMatch): void;
  /** Reactive outlet — drop `${router.view}` into a template. */
  view: () => Template;
}

export function createRouter(options: { routes: Route[]; guards?: Guard[] }): Router;

/* -------------------------------- http -------------------------------- */

export interface HttpRequestConfig {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  [option: string]: unknown;
}

export type RequestInterceptor = (
  config: HttpRequestConfig
) => HttpRequestConfig | void | Promise<HttpRequestConfig | void>;

export type ResponseInterceptor = (
  response: Response,
  config: HttpRequestConfig
) => Response | void | Promise<Response | void>;

export interface HttpOptions {
  headers?: Record<string, string>;
  [option: string]: unknown;
}

export class HttpError extends Error {
  name: 'HttpError';
  status: number;
  /** Parsed response body (JSON when the server sent JSON, else text). */
  body: unknown;
  response: Response;
  constructor(response: Response, body: unknown);
}

export interface HttpClient {
  request<T = unknown>(
    method: string,
    url: string,
    options?: HttpOptions & { body?: unknown }
  ): Promise<T>;
  get<T = unknown>(url: string, options?: HttpOptions): Promise<T>;
  delete<T = unknown>(url: string, options?: HttpOptions): Promise<T>;
  head<T = unknown>(url: string, options?: HttpOptions): Promise<T>;
  post<T = unknown>(url: string, body?: unknown, options?: HttpOptions): Promise<T>;
  put<T = unknown>(url: string, body?: unknown, options?: HttpOptions): Promise<T>;
  patch<T = unknown>(url: string, body?: unknown, options?: HttpOptions): Promise<T>;
  interceptors: {
    request: { use(fn: RequestInterceptor): void };
    response: { use(fn: ResponseInterceptor): void };
  };
}

export function createHttp(options?: {
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}): HttpClient;

/** Default HttpClient instance (no baseURL). */
export const http: HttpClient;

/* --------------------------------- ssr -------------------------------- */

/** Read state embedded by the server with serializeState(). Null in Node. */
export function getServerState<T = unknown>(): T | null;
