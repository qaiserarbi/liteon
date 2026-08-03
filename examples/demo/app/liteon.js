/**
 * Re-export shim: lets every file in this demo write
 *   import { signal, html } from '../liteon.js'
 * and have it resolve both in Node (filesystem) and the browser (URL),
 * because the dev server's web root mirrors the repository layout.
 * With the package published to npm this would simply be `from 'liteon'`.
 */
export * from '../../../src/index.js';
