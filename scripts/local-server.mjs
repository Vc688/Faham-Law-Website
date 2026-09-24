// Local preview: serves dist/ like Netlify (pretty URLs) and runs the admin API in mock mode.
// Usage: npm run build && ADMIN_PASSWORD=testpassword123 npm run preview
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

process.env.ADMIN_MOCK ??= '1';
process.env.ADMIN_PASSWORD ??= 'localpassword';
const { default: api } = await import('../netlify/functions/api.mjs');
const root = path.resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json', '.ico': 'image/x-icon' };
const redirects = { '/new-page': '/file-a-trademark', '/contact-faham': '/contact', '/home': '/', '/corporate-counsel': '/fractional-general-counsel' };

async function tryFile(p) {
  try { const st = await fs.stat(p); if (st.isFile()) return p; } catch {}
  return null;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const r = await api(request, { site: { id: 'local' } });
    const headers = Object.fromEntries(r.headers);
    res.writeHead(r.status, headers);
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  if (req.method === 'POST') { // pretend to be Netlify Forms
    for await (const _ of req) {}
    res.writeHead(303, { location: '/thank-you' }); res.end(); return;
  }
  if (redirects[url.pathname]) { res.writeHead(301, { location: redirects[url.pathname] }); res.end(); return; }
  let p = decodeURIComponent(url.pathname);
  if (p.startsWith('/uploads/')) {
    const f = await tryFile(path.join(path.resolve('public'), p));
    if (f) { res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(await fs.readFile(f)); return; }
  }
  const file = (await tryFile(path.join(root, p))) || (await tryFile(path.join(root, p + '.html'))) || (await tryFile(path.join(root, p, 'index.html')));
  if (!file) { res.writeHead(404, { 'content-type': 'text/html' }); res.end(await fs.readFile(path.join(root, '404.html'))); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  res.end(await fs.readFile(file));
}).listen(process.env.PORT || 4321, () => console.log(`Preview on http://localhost:${process.env.PORT || 4321}`));
