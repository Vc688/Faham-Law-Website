// Admin API for fahamlaw.com (/api/*). Netlify Functions v2.
import matter from 'gray-matter';
import { checkPassword, isAuthed, sessionCookie, clearCookie, adminPassword } from '../lib/auth.mjs';
import { storeMode, listDir, readText, readFile, readBlob, createBlob, commit, POSTS_DIR, UPLOADS_DIR } from '../lib/store.mjs';
import { netlifyConfigured, getSubmissions, getDeploys } from '../lib/netlify-api.mjs';

export const config = { path: '/api/*' };

const CATEGORIES = ['startups-small-business', 'corporate-counsel', 'mergers-acquisitions', 'real-estate', 'ip-trademarks'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UPLOAD_RE = /^\/uploads\/\d{4}\/\d{2}\/[a-z0-9][a-z0-9-]*\.(?:webp|jpe?g|png|gif)$/;
const MIME = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif' };

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const fail = (message, status = 400) => json({ error: message }, status);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toDateString(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v ?? '').slice(0, 10);
}

function parsePost(slug, text, sha) {
  const { data, content } = matter(text);
  return {
    slug,
    sha,
    title: data.title ?? '',
    description: data.description ?? '',
    date: toDateString(data.date),
    updated: data.updated ? toDateString(data.updated) : '',
    category: data.category ?? '',
    cover: data.cover ?? '',
    coverAlt: data.coverAlt ?? '',
    draft: Boolean(data.draft),
    body: content.replace(/^\n+/, ''),
  };
}

function serializePost(p) {
  const q = (s) => JSON.stringify(String(s)); // JSON strings are valid YAML
  const lines = [
    '---',
    `title: ${q(p.title)}`,
    `description: ${q(p.description)}`,
    `date: ${p.date}`,
    ...(p.updated ? [`updated: ${p.updated}`] : []),
    `category: ${p.category}`,
    ...(p.cover ? [`cover: ${q(p.cover)}`, `coverAlt: ${q(p.coverAlt || '')}`] : []),
    `draft: ${p.draft ? 'true' : 'false'}`,
    '---',
    '',
  ];
  return lines.join('\n') + p.body.trim() + '\n';
}

async function listPosts() {
  const files = (await listDir(POSTS_DIR)).filter((f) => f.name.endsWith('.md'));
  const posts = await Promise.all(
    files.map(async (f) => {
      const text = await readText(f);
      if (!text) return null;
      try {
        const p = parsePost(f.name.replace(/\.md$/, ''), text, f.sha);
        delete p.body;
        return p;
      } catch {
        return { slug: f.name.replace(/\.md$/, ''), title: f.name, error: 'Could not read this file', draft: true };
      }
    }),
  );
  return posts.filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

async function getPost(slug) {
  const files = await listDir(POSTS_DIR);
  const f = files.find((x) => x.name === `${slug}.md`);
  if (!f) return null;
  const text = await readText(f);
  return text ? parsePost(slug, text, f.sha) : null;
}

function validatePost(p) {
  if (!p || typeof p !== 'object') return 'Missing post.';
  if (!SLUG_RE.test(p.slug || '') || p.slug.length > 90) return 'The URL must use lowercase letters, numbers and hyphens.';
  if (!p.title?.trim() || p.title.length > 200) return 'Add a title (up to 200 characters).';
  if (!p.description?.trim() || p.description.length > 320) return 'Add a short summary (up to 320 characters).';
  if (!DATE_RE.test(p.date || '')) return 'Add a valid date.';
  if (!CATEGORIES.includes(p.category)) return 'Choose a category.';
  if (p.cover && !UPLOAD_RE.test(p.cover)) return 'Cover image is invalid.';
  if (typeof p.body !== 'string' || p.body.length > 200_000) return 'The article body is too long.';
  if (!p.draft && p.body.trim().length < 20) return 'The article is empty. Add content before publishing.';
  return null;
}

async function handle(req, context) {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const method = req.method;
  const secure = url.protocol === 'https:';

  // ---- Public routes ----
  if (route === 'login' && method === 'POST') {
    if (!adminPassword()) return fail('Admin is not configured yet. Set ADMIN_PASSWORD in Netlify.', 503);
    const body = await req.json().catch(() => ({}));
    if (!checkPassword(body.password || '')) {
      await sleep(900);
      return fail('Incorrect password.', 401);
    }
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(secure) });
  }
  if (route === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': clearCookie(secure) });
  }

  // ---- Everything below requires a session ----
  if (!isAuthed(req)) return fail('Not signed in.', 401);
  if (method !== 'GET' && req.headers.get('x-fl-admin') !== '1') return fail('Bad request.', 403);

  if (route === 'session') {
    return json({ ok: true, mode: storeMode(), netlify: netlifyConfigured() });
  }

  if (storeMode() === 'unconfigured' && (route.startsWith('posts') || route === 'upload' || route === 'media')) {
    return fail('Publishing is not configured yet. Add GITHUB_TOKEN and GITHUB_REPO in Netlify.', 503);
  }

  // Posts
  if (route === 'posts' && method === 'GET') return json({ posts: await listPosts() });

  const postMatch = route.match(/^posts\/([a-z0-9-]+)$/);
  if (postMatch && method === 'GET') {
    const p = await getPost(postMatch[1]);
    return p ? json({ post: p }) : fail('Post not found.', 404);
  }

  if (route === 'posts' && method === 'PUT') {
    const body = await req.json().catch(() => null);
    const p = body?.post;
    const err = validatePost(p);
    if (err) return fail(err);
    const existing = await getPost(p.slug);
    if (body.isNew && existing) return fail('A post with this URL already exists. Change the URL.', 409);
    if (!body.isNew && existing && body.baseSha && existing.sha !== body.baseSha) {
      return fail('This post was changed somewhere else since you opened it. Reload and try again.', 409);
    }
    const referenced = `${p.body}\n${p.cover || ''}`;
    const uploads = (Array.isArray(body.uploads) ? body.uploads : []).filter(
      (u) => UPLOAD_RE.test(u?.path || '') && /^[a-f0-9]{40}$/.test(u?.sha || '') && referenced.includes(u.path),
    );
    const changes = [
      { path: `${POSTS_DIR}/${p.slug}.md`, content: serializePost(p) },
      ...uploads.map((u) => ({ path: `${UPLOADS_DIR}${u.path.replace(/^\/uploads/, '')}`, sha: u.sha })),
    ];
    const wasLive = Boolean(existing && !existing.draft);
    const affectsSite = !p.draft || wasLive;
    const verb = p.draft ? (wasLive ? 'Unpublish' : 'Save draft') : existing && !existing.draft ? 'Update' : 'Publish';
    const message = `${verb}: ${p.title}${affectsSite ? '' : ' [skip netlify]'}`;
    const sha = await commit(changes, message);
    const saved = await getPost(p.slug);
    return json({ ok: true, commit: sha, deploys: affectsSite, post: saved });
  }

  if (postMatch && method === 'DELETE') {
    const existing = await getPost(postMatch[1]);
    if (!existing) return fail('Post not found.', 404);
    const message = `Delete post: ${existing.title}${existing.draft ? ' [skip netlify]' : ''}`;
    await commit([{ path: `${POSTS_DIR}/${existing.slug}.md`, delete: true }], message);
    return json({ ok: true, deploys: !existing.draft });
  }

  // Image upload: stores a blob (no commit yet). It's committed with the post on save.
  if (route === 'upload' && method === 'POST') {
    const body = await req.json().catch(() => null);
    const ext = String(body?.ext || '').toLowerCase();
    if (!MIME[ext]) return fail('Upload a JPG, PNG, WebP or GIF image.');
    const buf = Buffer.from(String(body?.data || ''), 'base64');
    if (!buf.length) return fail('Empty file.');
    if (buf.length > 4 * 1024 * 1024) return fail('Image is too large (max 4 MB after resizing).');
    const base = String(body?.name || 'image')
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'image';
    const now = new Date();
    const rand = Math.random().toString(36).slice(2, 7);
    const p = `/uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${base}-${rand}.${ext}`;
    const sha = await createBlob(buf);
    return json({ ok: true, path: p, sha });
  }

  // Serves uploaded images inside the admin (works before the site redeploys).
  if (route === 'media' && method === 'GET') {
    const p = url.searchParams.get('path') || '';
    const sha = url.searchParams.get('sha') || '';
    if (!UPLOAD_RE.test(p)) return fail('Bad path.');
    let buf = null;
    if (/^[a-f0-9]{40}$/.test(sha)) buf = await readBlob(sha);
    if (!buf) buf = await readFile(`${UPLOADS_DIR}${p.replace(/^\/uploads/, '')}`);
    if (!buf) return fail('Not found.', 404);
    const ext = p.split('.').pop();
    return new Response(buf, { headers: { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'private, max-age=3600' } });
  }

  // Form submissions
  if (route === 'submissions' && method === 'GET') {
    if (!netlifyConfigured()) return fail('Add NETLIFY_API_TOKEN in Netlify to see form submissions here.', 503);
    const form = url.searchParams.get('form') === 'trademark' ? 'trademark' : 'contact';
    return json({ form, submissions: await getSubmissions(form, context) });
  }

  if (route === 'deploys' && method === 'GET') {
    if (!netlifyConfigured()) return json({ deploys: [] });
    return json({ deploys: await getDeploys(context) });
  }

  return fail('Not found.', 404);
}

export default async function (req, context) {
  try {
    return await handle(req, context);
  } catch (e) {
    console.error(e);
    return fail('Something went wrong. ' + (e?.message || ''), 500);
  }
}
