/**
 * liteon/ssr — server-side rendering.
 *
 * renderToString(tpl)     -> HTML string with hydration markers
 * serializeState(obj)     -> <script> tag that transfers state to the client
 *
 * Dynamic child regions are wrapped in <!--liteon:i--> ... <!--/liteon:i-->
 * comments; the client's hydrate() uses them to locate the regions and
 * attach live bindings without rebuilding the static shell.
 */

import { isSignal } from './reactive.js';
import { isTemplate, analyze } from './template.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ESC[c]);
}

function unwrap(value) {
  if (isSignal(value)) return value.value;
  if (typeof value === 'function') return value();
  return value;
}

function renderChild(value) {
  value = unwrap(value);
  if (value == null || value === false || value === true) return '';
  if (Array.isArray(value)) return value.map(renderChild).join('');
  if (isTemplate(value)) return renderTemplate(value);
  return escapeHtml(value);
}

function renderAttr(name, value) {
  if (name.startsWith('on') || name === 'ref') return '';
  if (name === 'bind') {
    const v = unwrap(value);
    if (typeof v === 'boolean') return v ? 'checked' : '';
    return `value="${escapeHtml(v ?? '')}"`;
  }
  const v = unwrap(value);
  if (v === false || v == null) return '';
  if (v === true) return name;
  return `${name}="${escapeHtml(v)}"`;
}

function renderTemplate(result) {
  const { parts, statics } = analyze(result.strings);
  let out = '';
  for (let i = 0; i < statics.length; i++) {
    out += statics[i];
    if (i < parts.length) {
      const value = result.values[i];
      out +=
        parts[i].type === 'attr'
          ? renderAttr(parts[i].name, value)
          : `<!--liteon:${i}-->${renderChild(value)}<!--/liteon:${i}-->`;
    }
  }
  return out;
}

export function renderToString(value) {
  return isTemplate(value) ? renderTemplate(value) : renderChild(value);
}

/**
 * Serialize server state for the client. Read it back with getServerState().
 */
export function serializeState(state) {
  const json = JSON.stringify(state).replace(/</g, '\\u003c');
  return `<script>window.__LITEON__=${json}</script>`;
}
