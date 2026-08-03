/**
 * Types for 'liteon/ssr' — server-only rendering helpers.
 */

import type { Template, Child } from './index.js';

/**
 * Render a template (or any child value) to an HTML string with
 * hydration markers. Text is escaped; event handlers are skipped;
 * bind=${signal} renders as the input's value.
 */
export function renderToString(value: Template | Child): string;

/**
 * Serialize state into a <script> tag (window.__LITEON__ = …), with `<`
 * escaped so content can't break out of the tag. Read it back in the
 * browser with getServerState().
 */
export function serializeState(state: unknown): string;

/** Escape &, <, >, ", ' for safe interpolation into HTML. */
export function escapeHtml(s: unknown): string;
