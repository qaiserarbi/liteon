/**
 * demo/data — mock data source, used directly by the SSR server and
 * exposed to the browser through /api/* endpoints.
 */

export const USERS = [
  { id: 1, name: 'Amira Haddad', email: 'amira@example.com', role: 'Design' },
  { id: 2, name: 'Jonas Weber', email: 'jonas@example.com', role: 'Engineering' },
  { id: 3, name: 'Priya Raman', email: 'priya@example.com', role: 'Engineering' },
  { id: 4, name: 'Tomás Silva', email: 'tomas@example.com', role: 'Product' },
  { id: 5, name: 'Yuki Tanaka', email: 'yuki@example.com', role: 'Design' },
  { id: 6, name: 'Lena Novak', email: 'lena@example.com', role: 'Data' },
  { id: 7, name: 'Omar Farouk', email: 'omar@example.com', role: 'Engineering' },
  { id: 8, name: 'Grace Okafor', email: 'grace@example.com', role: 'Product' },
];

export function parseCookies(header = '') {
  const out = {};
  for (const pair of header.split(';')) {
    const i = pair.indexOf('=');
    if (i > -1) out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  }
  return out;
}
