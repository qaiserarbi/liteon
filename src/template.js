/**
 * liteon/template — the html`` tagged template and its compiler.
 *
 * html`<div>${x}</div>` returns a lightweight { strings, values } object.
 * The same object renders to real DOM in the browser (dom.js) and to an
 * HTML string on the server (ssr.js).
 *
 * Expression positions are discovered by scanning the static strings:
 *   - inside a tag  -> attribute part  (must be the full attribute value)
 *   - between tags  -> child part
 *
 * Special attributes:
 *   on<event>=${fn}   event listener            onclick=${save}
 *   bind=${signal}    two-way binding           bind=${name}
 *   ref=${fn}         element reference         ref=${el => ...}
 */

export const TEMPLATE = Symbol('liteon.template');

export function html(strings, ...values) {
  return { [TEMPLATE]: true, strings, values };
}

export function isTemplate(v) {
  return !!(v && v[TEMPLATE]);
}

/* ------------------------------------------------------------------ *
 * Static analysis shared by client and server.
 * analyze(strings) -> [{ type: 'attr'|'child', name? }, ...] with one
 * entry per expression slot, plus the strings rewritten so that attr
 * slots have their `name=` (and quotes) stripped out.
 * ------------------------------------------------------------------ */

const ATTR_RE = /([\w@:.-]+)=(['"])?\s*$/;
const analyzeCache = new WeakMap();

export function analyze(strings) {
  let cached = analyzeCache.get(strings);
  if (cached) return cached;

  const parts = [];
  const statics = [];
  let inTag = false;
  let stripQuote = false;

  for (let i = 0; i < strings.length; i++) {
    let s = strings[i];
    if (stripQuote) {
      s = s.replace(/^['"]/, '');
      stripQuote = false;
    }
    for (const ch of s) {
      if (ch === '<') inTag = true;
      else if (ch === '>') inTag = false;
    }
    if (i === strings.length - 1) {
      statics.push(s);
      break;
    }
    if (inTag) {
      const m = s.match(ATTR_RE);
      if (!m) {
        throw new Error(
          'liteon: expressions inside a tag must be a full attribute value, e.g. value=${x}'
        );
      }
      statics.push(s.slice(0, m.index));
      parts.push({ type: 'attr', name: m[1] });
      if (m[2]) stripQuote = true;
    } else {
      statics.push(s);
      parts.push({ type: 'child' });
    }
  }

  cached = { parts, statics };
  analyzeCache.set(strings, cached);
  return cached;
}
