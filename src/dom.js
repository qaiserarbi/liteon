/**
 * liteon/dom — browser renderer.
 *
 * render(tpl, container)   clear container, mount template, wire reactivity
 * hydrate(tpl, container)  reuse server-rendered static DOM, wire reactivity
 *
 * Hydration model ("regional hydration"): the static shell rendered by the
 * server — the vast majority of the page — is reused as-is; event listeners
 * and reactive attributes are attached to the existing elements. Dynamic
 * child regions (marked by the server with <!--liteon:i--> ... <!--/liteon:i-->
 * comments) are re-rendered in place so nested templates get live bindings.
 */

import { effect, isSignal } from './reactive.js';
import { isTemplate, analyze } from './template.js';

/* ---------------------------------------------------------------- *
 * Compilation: strings -> <template> with placeholders + part paths
 * ---------------------------------------------------------------- */

const compileCache = new WeakMap();

function compile(strings) {
  let compiled = compileCache.get(strings);
  if (compiled) return compiled;

  const { parts, statics } = analyze(strings);
  let out = '';
  for (let i = 0; i < statics.length; i++) {
    out += statics[i];
    if (i < parts.length) {
      out += parts[i].type === 'attr' ? ` data-liteon-a${i} ` : `<!--liteon:${i}-->`;
    }
  }

  const tpl = document.createElement('template');
  tpl.innerHTML = out;

  // Locate every part inside the parsed template and record its path
  // (a list of childNode indices from the root), then strip the markers
  // so cloned output is clean.
  const located = new Array(parts.length);
  (function walk(node, path) {
    const children = [...node.childNodes];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const p = [...path, i];
      if (child.nodeType === 8) {
        const m = /^liteon:(\d+)$/.exec(child.data);
        if (m) located[+m[1]] = { type: 'child', path: p };
      } else if (child.nodeType === 1) {
        for (const attr of [...child.attributes]) {
          const m = /^data-liteon-a(\d+)$/.exec(attr.name);
          if (m) {
            located[+m[1]] = { type: 'attr', name: parts[+m[1]].name, path: p };
            child.removeAttribute(attr.name);
          }
        }
        walk(child, p);
      }
    }
  })(tpl.content, []);

  compiled = { content: tpl.content, parts: located };
  compileCache.set(strings, compiled);
  return compiled;
}

function nodeAt(root, path) {
  let n = root;
  for (const i of path) n = n.childNodes[i];
  return n;
}

/* ---------------------------------------------------------------- *
 * Instantiation: template result -> live DOM fragment
 * ---------------------------------------------------------------- */

function instantiate(result) {
  const compiled = compile(result.strings);
  const fragment = compiled.content.cloneNode(true);
  const disposers = [];

  // Resolve every part's node BEFORE applying anything: applyChild replaces
  // one comment with two, which would shift the recorded paths of later
  // siblings. Node references stay valid; indices don't.
  const nodes = compiled.parts.map((part) => nodeAt(fragment, part.path));

  for (let i = 0; i < compiled.parts.length; i++) {
    const part = compiled.parts[i];
    const value = result.values[i];
    if (part.type === 'attr') {
      applyAttr(nodes[i], part.name, value, disposers);
    } else {
      applyChild(nodes[i], value, disposers);
    }
  }

  return {
    node: fragment,
    dispose() {
      for (const d of disposers) d();
      disposers.length = 0;
    },
  };
}

/* ---------------------------------------------------------------- *
 * Attribute parts
 * ---------------------------------------------------------------- */

function setAttr(el, name, v) {
  if (name === 'value') {
    el.value = v ?? '';
  } else if (name === 'checked' || name === 'disabled' || name === 'selected') {
    el[name] = !!v;
    if (!v) el.removeAttribute(name);
  } else if (v === false || v == null) {
    el.removeAttribute(name);
  } else {
    el.setAttribute(name, v === true ? '' : v);
  }
}

function applyAttr(el, name, value, disposers) {
  if (name.startsWith('on')) {
    el.addEventListener(name.slice(2).toLowerCase(), value);
  } else if (name === 'bind') {
    if (!isSignal(value)) throw new Error('liteon: bind expects a signal');
    const isCheckbox = el.type === 'checkbox';
    disposers.push(
      effect(() => {
        if (isCheckbox) el.checked = !!value.value;
        else if (el.value !== String(value.value ?? '')) el.value = value.value ?? '';
      })
    );
    el.addEventListener('input', () => {
      value.value = isCheckbox ? el.checked : el.value;
    });
  } else if (name === 'ref') {
    value(el);
  } else if (isSignal(value)) {
    disposers.push(effect(() => setAttr(el, name, value.value)));
  } else if (typeof value === 'function') {
    disposers.push(effect(() => setAttr(el, name, value())));
  } else {
    setAttr(el, name, value);
  }
}

/* ---------------------------------------------------------------- *
 * Child parts: a region between two comment anchors whose content is
 * replaced whenever the bound expression changes.
 * ---------------------------------------------------------------- */

function applyChild(anchor, value, disposers) {
  const start = document.createComment('liteon');
  const end = document.createComment('/liteon');
  anchor.replaceWith(start, end);
  bindRegion({ start, end, disposers: [] }, value, disposers);
}

function bindRegion(region, value, disposers) {
  if (isSignal(value)) {
    disposers.push(effect(() => updateRegion(region, value.value)));
  } else if (typeof value === 'function') {
    disposers.push(effect(() => updateRegion(region, value())));
  } else {
    updateRegion(region, value);
  }
  disposers.push(() => clearRegion(region));
}

function clearRegion(region) {
  for (const d of region.disposers) d();
  region.disposers.length = 0;
  let n = region.start.nextSibling;
  while (n && n !== region.end) {
    const next = n.nextSibling;
    n.remove();
    n = next;
  }
}

function updateRegion(region, value) {
  clearRegion(region);
  const frag = document.createDocumentFragment();
  mountValue(frag, value, region.disposers);
  region.end.before(frag);
}

function mountValue(parent, value, disposers) {
  if (value == null || value === false || value === true) return;
  if (Array.isArray(value)) {
    for (const v of value) mountValue(parent, v, disposers);
  } else if (isTemplate(value)) {
    const inst = instantiate(value);
    disposers.push(inst.dispose);
    parent.appendChild(inst.node);
  } else if (isSignal(value)) {
    const t = document.createTextNode('');
    disposers.push(effect(() => (t.data = String(value.value ?? ''))));
    parent.appendChild(t);
  } else if (typeof Node !== 'undefined' && value instanceof Node) {
    parent.appendChild(value);
  } else {
    parent.appendChild(document.createTextNode(String(value)));
  }
}

/* ---------------------------------------------------------------- *
 * Public API
 * ---------------------------------------------------------------- */

export function render(result, container) {
  container.textContent = '';
  const inst = instantiate(result);
  container.appendChild(inst.node);
  return inst.dispose;
}

/* ---------------------------------------------------------------- *
 * Hydration.
 *
 * The server marks every dynamic child region with
 * <!--liteon:i--> ... <!--/liteon:i--> comments, recursively — nested
 * templates carry their own markers. hydrate() walks the compiled
 * template and the live DOM side by side:
 *
 *   static elements/text  -> reused as-is (listeners + reactive attrs
 *                            are attached to the existing nodes)
 *   child regions         -> their current value is hydrated in place,
 *                            recursively; later reactive updates
 *                            re-render the region
 *
 * Any mismatch between what the server sent and what the client would
 * render (stale auth state, merged text nodes, version drift…) is caught
 * and that region — or, at worst, the whole tree — is re-rendered.
 * Hydration is an optimization, never a correctness risk.
 * ---------------------------------------------------------------- */

function mismatch(why) {
  const e = new Error(`liteon: hydration mismatch (${why})`);
  e.liteon = 'mismatch';
  return e;
}

export function hydrate(result, container) {
  const disposers = [];
  try {
    hydrateSpan(result, [...container.childNodes], 0, disposers);
    return () => {
      for (const d of disposers) d();
      disposers.length = 0;
    };
  } catch (e) {
    if (!e || e.liteon !== 'mismatch') throw e;
    for (const d of disposers) d();
    return render(result, container); // safe fallback: client render
  }
}

/** Part-lookup maps, cached on the compiled template. */
function partMaps(compiled) {
  if (compiled.maps) return compiled.maps;
  const childParts = new Map(); // template comment node -> part index
  const attrParts = new Map(); // template element -> [{index, name}]
  for (let i = 0; i < compiled.parts.length; i++) {
    const part = compiled.parts[i];
    const node = nodeAt(compiled.content, part.path);
    if (part.type === 'child') {
      childParts.set(node, i);
    } else {
      if (!attrParts.has(node)) attrParts.set(node, []);
      attrParts.get(node).push({ index: i, name: part.name });
    }
  }
  return (compiled.maps = { childParts, attrParts });
}

/**
 * Hydrate one template against a span of live sibling nodes, starting
 * at index `li`. Returns the index just past the last node consumed.
 */
function hydrateSpan(result, live, li, disposers) {
  const compiled = compile(result.strings);
  const { childParts, attrParts } = partMaps(compiled);

  for (const tn of compiled.content.childNodes) {
    li = alignNode(tn, live, li, result.values, childParts, attrParts, disposers);
  }
  return li;
}

function alignNode(tn, live, li, values, childParts, attrParts, disposers) {
  // Dynamic child region: <!--liteon:i-->…<!--/liteon:i--> in the live DOM.
  if (tn.nodeType === 8 && childParts.has(tn)) {
    while (li < live.length && live[li].nodeType === 3) li++; // skip text
    const start = live[li];
    if (!start || start.nodeType !== 8 || !/^liteon:\d+$/.test(start.data)) {
      throw mismatch('missing region marker');
    }
    let depth = 0;
    let j = li;
    for (; j < live.length; j++) {
      const n = live[j];
      if (n.nodeType === 8) {
        if (/^liteon:\d+$/.test(n.data)) depth++;
        else if (/^\/liteon:\d+$/.test(n.data) && --depth === 0) break;
      }
    }
    const end = live[j];
    if (!end) throw mismatch('unclosed region marker');
    const region = { start, end, disposers: [] };
    hydrateRegionBinding(region, values[childParts.get(tn)], disposers);
    return j + 1;
  }

  // Static element: reuse it, attach dynamic attributes, recurse.
  if (tn.nodeType === 1) {
    while (li < live.length && live[li].nodeType !== 1) li++;
    const ln = live[li];
    if (!ln || ln.tagName !== tn.tagName) throw mismatch(`expected <${tn.tagName}>`);
    const attrs = attrParts.get(tn);
    if (attrs) {
      for (const a of attrs) applyAttr(ln, a.name, values[a.index], disposers);
    }
    const kids = [...ln.childNodes];
    let ki = 0;
    for (const child of tn.childNodes) {
      ki = alignNode(child, kids, ki, values, childParts, attrParts, disposers);
    }
    return li + 1;
  }

  // Static text: consume the matching live text node if present.
  if (tn.nodeType === 3) {
    if (live[li] && live[li].nodeType === 3) return li + 1;
    return li; // parser dropped it (whitespace-only) — fine
  }

  return li + 1; // plain HTML comment written by the user
}

/**
 * Bind a region during hydration: the first value is hydrated against
 * the server-rendered content; reactive updates after that re-render.
 */
function hydrateRegionBinding(region, value, disposers) {
  let first = true;
  const apply = (v) => {
    if (first) {
      first = false;
      try {
        hydrateRegionValue(region, v);
        return;
      } catch (e) {
        if (!e || e.liteon !== 'mismatch') throw e;
        // fall through: server and client disagree — re-render region
      }
    }
    updateRegion(region, v);
  };
  if (isSignal(value)) {
    disposers.push(effect(() => apply(value.value)));
  } else if (typeof value === 'function') {
    disposers.push(effect(() => apply(value())));
  } else {
    apply(value);
  }
  disposers.push(() => clearRegion(region));
}

function hydrateRegionValue(region, value) {
  const span = [];
  for (let n = region.start.nextSibling; n && n !== region.end; n = n.nextSibling) {
    span.push(n);
  }
  const consumed = hydrateValue(span, 0, value, region.disposers, region.end);
  for (let i = consumed; i < span.length; i++) {
    if (span[i].nodeType !== 3 || span[i].data.trim() !== '') {
      throw mismatch('leftover server content');
    }
  }
}

function hydrateValue(span, cursor, value, disposers, endAnchor) {
  if (value == null || value === false || value === true) return cursor;

  if (Array.isArray(value)) {
    for (const v of value) cursor = hydrateValue(span, cursor, v, disposers, endAnchor);
    return cursor;
  }

  if (isTemplate(value)) {
    return hydrateSpan(value, span, cursor, disposers);
  }

  if (isSignal(value)) {
    const t = span[cursor];
    if (t && t.nodeType === 3 && t.data === String(value.peek() ?? '')) {
      disposers.push(effect(() => (t.data = String(value.value ?? ''))));
      return cursor + 1;
    }
    if (!t && String(value.peek() ?? '') === '') {
      // SSR of '' emits no text node; create one to bind to.
      const nt = document.createTextNode('');
      endAnchor.before(nt);
      disposers.push(effect(() => (nt.data = String(value.value ?? ''))));
      return cursor;
    }
    throw mismatch('text differs from server');
  }

  // Static string / number.
  const t = span[cursor];
  const expected = String(value);
  if (expected === '') return cursor;
  if (t && t.nodeType === 3 && t.data === expected) return cursor + 1;
  throw mismatch('static text differs from server');
}
