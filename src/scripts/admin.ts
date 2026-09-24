// Faham Law admin dashboard (/admin). Vanilla TS + Tiptap editor.
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';
import { marked } from 'marked';
import TurndownService from 'turndown';

/* ---------------- Constants ---------------- */
let CATEGORIES: Record<string, string> = {};
async function loadCategories() {
  try {
    const { categories } = await api<{ categories: { slug: string; name: string }[] }>('categories');
    CATEGORIES = Object.fromEntries(categories.map((c) => [c.slug, c.name]));
  } catch { /* keep whatever we had */ }
}
const FORMS = {
  contact: {
    label: 'Contact',
    fields: [
      ['first_name', 'First name'], ['last_name', 'Last name'], ['email', 'Email'], ['phone', 'Phone'],
      ['reason', 'Reason of inquiry'], ['message', 'How can we help?'],
    ],
  },
  trademark: {
    label: 'Trademark',
    fields: [
      ['owner_name', 'Owner name'], ['entity_type', 'Entity type'], ['email', 'Email'], ['phone', 'Phone'],
      ['country', 'Country'], ['address_line1', 'Address line 1'], ['address_line2', 'Address line 2'],
      ['city', 'City'], ['state', 'State'], ['zip', 'ZIP'], ['mark_words', 'Mark (exact words)'], ['logo', 'Logo file'],
      ['goods_services', 'Goods / services'], ['first_use', 'First use'],
    ],
  },
} as const;
type FormName = keyof typeof FORMS;

/* ---------------- Helpers ---------------- */
const app = document.getElementById('app')!;
const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const fmtDate = (s: string) => (s ? new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const fmtDateTime = (s: string) => new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const ago = (s: string) => {
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return fmtDate(s);
};
const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

let toastTimer: number | undefined;
function toast(msg: string, bad = false) {
  const t = document.getElementById('toast')!;
  t.textContent = msg;
  t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.className = ''), bad ? 6000 : 3500);
}

class ApiError extends Error { status = 0; }
async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: opts.method || 'GET',
    credentials: 'same-origin',
    headers: { 'x-fl-admin': '1', ...(opts.body ? { 'content-type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== 'login') {
    session = null;
    renderLogin('Your session ended. Please sign in again.');
    throw Object.assign(new ApiError('Not signed in'), { status: 401 });
  }
  if (!res.ok) throw Object.assign(new ApiError(data.error || `Request failed (${res.status})`), { status: res.status });
  return data as T;
}

function modal(opts: { title: string; fields: { name: string; label: string; value?: string; hint?: string }[]; ok: string }) {
  return new Promise<Record<string, string> | null>((resolve) => {
    const bg = document.createElement('div');
    bg.className = 'drawer-bg';
    bg.style.display = 'grid';
    bg.style.placeItems = 'center';
    bg.innerHTML = `
      <form class="card" style="width:min(440px,92vw);padding:24px;display:grid;gap:14px">
        <h2 style="margin:0;font-family:var(--serif);font-weight:400;font-size:1.7rem">${esc(opts.title)}</h2>
        ${opts.fields.map((f) => `<div class="field"><label for="m-${f.name}">${esc(f.label)}</label><input type="text" id="m-${f.name}" name="${f.name}" value="${esc(f.value || '')}" />${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`).join('')}
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-ghost" data-cancel style="flex:0">Cancel</button><button class="btn" style="flex:0">${esc(opts.ok)}</button></div>
      </form>`;
    document.body.appendChild(bg);
    const form = $('form', bg) as HTMLFormElement;
    const close = (v: Record<string, string> | null) => { bg.remove(); resolve(v); };
    form.addEventListener('submit', (e) => { e.preventDefault(); close(Object.fromEntries(new FormData(form)) as Record<string, string>); });
    $('[data-cancel]', bg).addEventListener('click', () => close(null));
    bg.addEventListener('click', (e) => { if (e.target === bg) close(null); });
    bg.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape') close(null); });
    ($('input', bg) as HTMLInputElement)?.focus();
  });
}

/* ---------------- Session + routing ---------------- */
let session: { mode: string; netlify: boolean } | null = null;
let leaveGuard: (() => boolean) | null = null;
let currentHash = location.hash;

async function boot() {
  app.innerHTML = `<div class="loading"><span class="spinner"></span></div>`;
  try {
    session = await api('session');
    route();
  } catch (e) {
    if ((e as ApiError).status !== 401) renderLogin();
  }
}

window.addEventListener('hashchange', () => {
  if (leaveGuard && !leaveGuard()) {
    history.replaceState(null, '', currentHash || '#/');
    return;
  }
  route();
});
window.addEventListener('beforeunload', (e) => {
  if (leaveGuard && !leaveGuard.call(null, true as any)) { e.preventDefault(); }
});

function route() {
  if (!session) return renderLogin();
  leaveGuard = null;
  currentHash = location.hash || '#/';
  const h = currentHash.replace(/^#\/?/, '').split('?')[0];
  const [a, b, c] = h.split('/');
  if (a === 'posts' && b === 'new') return renderEditor(null);
  if (a === 'posts' && b === 'edit' && c) return renderEditor(decodeURIComponent(c));
  if (a === 'posts') return renderPosts();
  if (a === 'site') return renderSite(b || '');
  if (a === 'inquiries') return renderInquiries((b as FormName) in FORMS ? (b as FormName) : 'contact');
  return renderDashboard();
}

function shell(active: string, inner: string) {
  const tab = (href: string, label: string, key: string) => `<a href="${href}" class="${active === key ? 'on' : ''}">${label}</a>`;
  app.innerHTML = `
    <header class="top"><div class="top-in">
      <a class="brand" href="#/"><img src="/images/logo.png" alt="Faham Law" width="1323" height="353" /><small>Admin</small></a>
      <nav class="tabs" aria-label="Admin">
        ${tab('#/', 'Dashboard', 'dash')}${tab('#/site', 'Site', 'site')}${tab('#/posts', 'Posts', 'posts')}${tab('#/inquiries/contact', 'Inquiries', 'inq')}
      </nav>
      <div class="top-actions">
        <span id="site-pill" class="hide-sm"></span>
        <a class="btn btn-ghost btn-sm hide-sm" href="/" target="_blank" rel="noopener">View site ↗</a>
        <button class="btn btn-ghost btn-sm" id="logout">Log out</button>
      </div>
    </div></header>
    <main class="wrap">${inner}</main>`;
  $('#logout').addEventListener('click', async () => {
    if (leaveGuard && !leaveGuard()) return;
    leaveGuard = null;
    await api('logout', { method: 'POST' }).catch(() => {});
    session = null;
    renderLogin();
  });
  refreshSitePill();
}

/* ---------------- Deploy status pill ---------------- */
let pillTimer: number | undefined;
function deployBadge(d?: { state: string }) {
  if (!d) return '';
  if (d.state === 'ready') return `<span class="badge b-live">Site live</span>`;
  if (d.state === 'error') return `<span class="badge b-err">Last update failed</span>`;
  return `<span class="badge b-build">Updating site…</span>`;
}
async function refreshSitePill() {
  clearTimeout(pillTimer);
  if (!session?.netlify) return;
  try {
    const { deploys } = await api<{ deploys: any[] }>('deploys');
    const d = deploys.find((x) => x.context === 'production' || !x.context) || deploys[0];
    const el = document.getElementById('site-pill');
    if (el) el.innerHTML = deployBadge(d);
    if (d && !['ready', 'error'].includes(d.state)) pillTimer = window.setTimeout(refreshSitePill, 8000);
  } catch { /* ignore */ }
}

/* ---------------- Login ---------------- */
function renderLogin(message = '') {
  leaveGuard = null;
  app.innerHTML = `
    <div class="login">
      <form class="login-card" id="login-form">
        <img class="login-logo" src="/images/logo.png" alt="Faham Law LLC" width="1323" height="353" />
        <h1>Website admin</h1>
        <p class="muted login-sub">Write and publish Insights, and review contact and trademark inquiries.</p>
        ${message ? `<div class="warn">${esc(message)}</div>` : ''}
        <div id="login-err"></div>
        <input type="password" id="pw" name="password" autocomplete="current-password" placeholder="Admin password" aria-label="Password" required autofocus />
        <button class="btn btn-block" type="submit">Sign in</button>
        <a href="/" class="muted back">← Back to fahamlaw.com</a>
      </form>
    </div>`;
  const form = $('#login-form') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button', form) as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>`;
    try {
      await api('login', { method: 'POST', body: { password: ($('#pw') as HTMLInputElement).value } });
      session = await api('session');
      if (!location.hash || location.hash === '#') location.hash = '#/';
      route();
    } catch (err) {
      $('#login-err').innerHTML = `<div class="err">${esc((err as Error).message)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Sign in';
      ($('#pw') as HTMLInputElement).select();
    }
  });
}

/* ---------------- Dashboard ---------------- */
function setupWarnings() {
  const w: string[] = [];
  if (session?.mode === 'unconfigured') w.push('Publishing is not set up yet. Add <b>GITHUB_TOKEN</b> and <b>GITHUB_REPO</b> in Netlify → Site configuration → Environment variables (see README).');
  if (!session?.netlify) w.push('Form inquiries and site status need <b>NETLIFY_API_TOKEN</b> in Netlify environment variables (see README).');
  if (session?.mode === 'mock') w.push('Local test mode: changes are saved to this computer, not GitHub.');
  return w.map((x) => `<div class="warn" style="margin-bottom:12px">${x}</div>`).join('');
}

async function renderDashboard() {
  shell('dash', `
    <div class="page-head"><div><h1>Dashboard</h1><p>${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p></div>
    <div class="row" style="flex:0"><a class="btn btn-ghost" href="#/site">Edit site content</a><a class="btn" href="#/posts/new">+ New post</a></div></div>
    ${setupWarnings()}
    <div id="dash"><div class="loading"><span class="spinner"></span></div></div>`);

  const safe = <T,>(p: Promise<T>) => p.catch(() => null);
  const [postsRes, contactRes, tmRes, depRes] = await Promise.all([
    session?.mode !== 'unconfigured' ? safe(api<{ posts: any[] }>('posts')) : Promise.resolve(null),
    session?.netlify ? safe(api<{ submissions: any[] }>('submissions?form=contact')) : Promise.resolve(null),
    session?.netlify ? safe(api<{ submissions: any[] }>('submissions?form=trademark')) : Promise.resolve(null),
    session?.netlify ? safe(api<{ deploys: any[] }>('deploys')) : Promise.resolve(null),
  ]);
  const el = document.getElementById('dash');
  if (!el) return;
  const posts = postsRes?.posts || [];
  const live = posts.filter((p) => !p.draft);
  const drafts = posts.filter((p) => p.draft);
  const since = Date.now() - 30 * 86400000;
  const c = contactRes?.submissions || [];
  const t = tmRes?.submissions || [];
  const recent30 = (arr: any[]) => arr.filter((s) => new Date(s.created_at).getTime() > since).length;
  const na = (res: unknown, v: number | string) => (res ? v : '–');

  const inbox = [
    ...c.map((s) => ({ ...s, form: 'contact', who: `${s.data.first_name || ''} ${s.data.last_name || ''}`.trim(), what: s.data.reason || '' })),
    ...t.map((s) => ({ ...s, form: 'trademark', who: s.data.owner_name || '', what: `Trademark: ${s.data.mark_words || ''}` })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
  const deps = depRes?.deploys || [];

  el.innerHTML = `
    <div class="stats">
      <a class="card stat" href="#/posts"><span class="k">Published posts</span><span class="v">${na(postsRes, live.length)}</span><span class="s">${live[0] ? 'Latest ' + esc(fmtDate(live[0].date)) : 'None yet'}</span></a>
      <a class="card stat" href="#/posts"><span class="k">Drafts</span><span class="v">${na(postsRes, drafts.length)}</span><span class="s">Not visible on the site</span></a>
      <a class="card stat" href="#/inquiries/contact"><span class="k">Contact inquiries</span><span class="v">${na(contactRes, recent30(c))}</span><span class="s">Last 30 days · ${na(contactRes, c.length)} total</span></a>
      <a class="card stat" href="#/inquiries/trademark"><span class="k">Trademark requests</span><span class="v">${na(tmRes, recent30(t))}</span><span class="s">Last 30 days · ${na(tmRes, t.length)} total</span></a>
    </div>
    <div class="grid2">
      <section class="card">
        <div class="panel-h"><h2>Latest inquiries</h2><a class="btn btn-ghost btn-sm" href="#/inquiries/contact">View all</a></div>
        ${inbox.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Received</th><th>From</th><th>About</th></tr></thead><tbody>
          ${inbox.map((s) => `<tr class="click" data-go="#/inquiries/${s.form}?id=${esc(s.id)}"><td>${esc(ago(s.created_at))}</td><td class="title">${esc(s.who || s.data.email)}</td><td class="clip">${esc(s.what)}</td></tr>`).join('')}
        </tbody></table></div>` : `<div class="empty">${contactRes ? 'No inquiries yet.' : 'Inquiries appear here once the Netlify token is set.'}</div>`}
      </section>
      <div style="display:grid;gap:20px">
        <section class="card">
          <div class="panel-h"><h2>Website updates</h2></div>
          <div class="panel-b">
            ${deps.length ? `<ul class="mini-list">${deps.slice(0, 4).map((d) => `<li><span>${esc((d.title || 'Update').replace(/\s*\[skip netlify\]/, ''))}<br><span class="muted" style="font-size:.8rem">${esc(fmtDateTime(d.created_at))}</span></span>${deployBadge(d).replace('Site live', 'Live')}</li>`).join('')}</ul>` : `<p class="muted">Publishing history appears here once the Netlify token is set.</p>`}
          </div>
        </section>
        <section class="card">
          <div class="panel-h"><h2>Recent posts</h2><a class="btn btn-ghost btn-sm" href="#/posts">All posts</a></div>
          <div class="panel-b">
            ${posts.length ? `<ul class="mini-list">${posts.slice(0, 5).map((p) => `<li><a href="#/posts/edit/${encodeURIComponent(p.slug)}" style="text-decoration:none;font-weight:600">${esc(p.title)}</a>${p.draft ? '<span class="badge b-draft">Draft</span>' : '<span class="badge b-live">Live</span>'}</li>`).join('')}</ul>` : `<p class="muted">No posts yet. <a href="#/posts/new">Write the first one →</a></p>`}
          </div>
        </section>
      </div>
    </div>`;
  $$('tr[data-go]', el).forEach((tr) => tr.addEventListener('click', () => (location.hash = tr.dataset.go!)));
}

/* ---------------- Posts list ---------------- */
async function renderPosts() {
  shell('posts', `
    <div class="page-head"><div><h1>Posts</h1><p>Articles in the Insights section of the website.</p></div><a class="btn" href="#/posts/new">+ New post</a></div>
    ${setupWarnings()}
    <div class="filters"><div class="seg" id="pf"><button class="on" data-f="all">All</button><button data-f="live">Published</button><button data-f="draft">Drafts</button></div></div>
    <section class="card" id="plist"><div class="loading"><span class="spinner"></span></div></section>`);
  let posts: any[] = [];
  try {
    const res = await api<{ posts: any[]; categories?: { slug: string; name: string }[] }>('posts');
    posts = res.posts;
    if (res.categories) CATEGORIES = Object.fromEntries(res.categories.map((c) => [c.slug, c.name]));
  } catch (e) {
    $('#plist').innerHTML = `<div class="empty">${esc((e as Error).message)}</div>`;
    return;
  }
  let filter = 'all';
  const draw = () => {
    const list = posts.filter((p) => filter === 'all' || (filter === 'live' ? !p.draft : p.draft));
    $('#plist').innerHTML = list.length
      ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Title</th><th>Category</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>
        ${list.map((p) => `<tr class="click" data-slug="${esc(p.slug)}">
          <td><div class="title">${esc(p.title)}</div><div class="muted" style="font-size:.8rem">/insights/${esc(p.slug)}</div></td>
          <td>${esc(CATEGORIES[p.category] || '—')}</td>
          <td style="white-space:nowrap">${esc(fmtDate(p.date))}</td>
          <td>${p.error ? '<span class="badge b-err">Error</span>' : p.draft ? '<span class="badge b-draft">Draft</span>' : '<span class="badge b-live">Published</span>'}</td>
          <td style="text-align:right;white-space:nowrap">${!p.draft ? `<a class="btn btn-ghost btn-sm" href="/insights/${esc(p.slug)}" target="_blank" rel="noopener" data-stop>View ↗</a>` : ''}</td>
        </tr>`).join('')}
      </tbody></table></div>`
      : `<div class="empty">${posts.length ? 'Nothing in this view.' : 'No posts yet.'}<br><br><a class="btn" href="#/posts/new">Write your first post</a></div>`;
    $$('tr[data-slug]').forEach((tr) => tr.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-stop]')) return;
      location.hash = `#/posts/edit/${encodeURIComponent(tr.dataset.slug!)}`;
    }));
  };
  $$('#pf button').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.f!;
    $$('#pf button').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  }));
  draw();
}

/* ---------------- Images ---------------- */
async function fileToUpload(file: File): Promise<{ name: string; ext: string; data: string; blob: Blob }> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPG, PNG, WebP or GIF).');
  let blob: Blob = file;
  let ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  if (file.type !== 'image/gif') {
    const bmp = await createImageBitmap(file);
    const max = 1800;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not process image'))), 'image/webp', 0.85));
    ext = 'webp';
  }
  if (blob.size > 4 * 1024 * 1024) throw new Error('Image is too large even after resizing (max 4 MB).');
  const data = await new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.readAsDataURL(blob);
  });
  return { name: file.name, ext, data, blob };
}

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

/* ---------------- Editor ---------------- */
const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*', hr: '---' });
turndown.addRule('tightListItems', {
  filter: 'li',
  replacement(content, node) {
    const parent = node.parentNode as HTMLElement;
    const index = Array.prototype.indexOf.call(parent.children, node);
    const prefix = parent.nodeName === 'OL' ? `${(Number(parent.getAttribute('start')) || 1) + index}. ` : '- ';
    const body = content.replace(/^\n+/, '').replace(/\n+$/, '\n').replace(/\n(?!$)/gm, '\n' + ' '.repeat(prefix.length));
    return prefix + body + (node.nextSibling && !/\n$/.test(body) ? '\n' : '');
  },
});

async function renderEditor(slug: string | null) {
  const isNew = !slug;
  shell('posts', `<div class="loading"><span class="spinner"></span>Loading…</div>`);
  if (session?.mode === 'unconfigured') {
    $('main.wrap').innerHTML = setupWarnings();
    return;
  }
  let post: any = {
    slug: '', title: '', description: '', date: today(), category: '', cover: '', coverAlt: '', draft: true, body: '',
  };
  let baseSha = '';
  await loadCategories();
  if (!isNew) {
    try {
      const res = await api<{ post: any }>(`posts/${encodeURIComponent(slug!)}`);
      post = res.post;
      baseSha = post.sha;
    } catch (e) {
      $('main.wrap').innerHTML = `<div class="empty">${esc((e as Error).message)}<br><br><a class="btn" href="#/posts">Back to posts</a></div>`;
      return;
    }
  }
  const wasLive = !isNew && !post.draft;
  const uploads = new Map<string, { sha: string; url: string }>();
  let slugTouched = !isNew;
  let dirty = false;
  let saving = false;

  const displaySrc = (p: string) => (uploads.get(p)?.url ?? `/api/media?path=${encodeURIComponent(p)}`);
  const toEditorHtml = (md: string) => {
    const html = marked.parse(md || '', { async: false }) as string;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (src.startsWith('/uploads/')) img.setAttribute('src', displaySrc(src));
    });
    return doc.body.innerHTML;
  };
  const fromEditorHtml = (html: string) => {
    let md = turndown.turndown(html);
    for (const [p, u] of uploads) md = md.split(u.url).join(p);
    md = md.replace(/\/api\/media\?path=([^)\s"]+)/g, (_m, enc) => decodeURIComponent(enc));
    return md.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  };

  const catOptions = Object.entries(CATEGORIES).map(([v, l]) => `<option value="${v}" ${post.category === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
  $('main.wrap').innerHTML = `
    <div class="page-head" style="margin-bottom:16px">
      <div><a href="#/posts" class="muted" style="text-decoration:none;font-size:.9rem">← All posts</a></div>
      <div class="row" style="flex:0"><span id="dirty" class="muted" style="font-size:.85rem;white-space:nowrap"></span></div>
    </div>
    <div class="ed">
      <div class="card ed-main">
        <textarea class="ed-title" id="title" rows="1" placeholder="Post title">${esc(post.title)}</textarea>
        <div class="toolbar" id="tb" role="toolbar" aria-label="Formatting">
          <button type="button" data-cmd="p" title="Normal text">¶</button>
          <button type="button" data-cmd="h2" title="Heading">H2</button>
          <button type="button" data-cmd="h3" title="Subheading">H3</button>
          <span class="sep"></span>
          <button type="button" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
          <button type="button" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
          <button type="button" data-cmd="link" title="Link">Link</button>
          <span class="sep"></span>
          <button type="button" data-cmd="ul" title="Bulleted list">• List</button>
          <button type="button" data-cmd="ol" title="Numbered list">1. List</button>
          <button type="button" data-cmd="quote" title="Quote">“ ”</button>
          <button type="button" data-cmd="hr" title="Divider">—</button>
          <button type="button" data-cmd="image" title="Insert image">Image</button>
          <span class="sep"></span>
          <button type="button" data-cmd="undo" title="Undo">↶</button>
          <button type="button" data-cmd="redo" title="Redo">↷</button>
        </div>
        <div id="editor"></div>
      </div>

      <aside class="side">
        <div class="card">
          <div class="status-line"><h3>Status</h3><span id="status-badge">${isNew ? '<span class="badge b-draft">New</span>' : post.draft ? '<span class="badge b-draft">Draft</span>' : '<span class="badge b-live">Published</span>'}</span></div>
          <div id="save-err"></div>
          <div class="row" id="save-btns"></div>
          <p class="muted" style="font-size:.8rem;margin:0">Drafts are private. Publishing updates fahamlaw.com in about 1–2 minutes.</p>
          ${wasLive ? `<a class="btn btn-ghost btn-sm" href="/insights/${esc(post.slug)}" target="_blank" rel="noopener">View on site ↗</a>` : ''}
        </div>

        <div class="card">
          <h3>Details</h3>
          <div class="field"><label for="cat">Category</label><select id="cat"><option value="" ${post.category ? '' : 'selected'} disabled>Choose a category</option>${catOptions}</select></div>
          <div class="field"><label for="date">Publish date</label><input type="date" id="date" value="${esc(post.date)}" /></div>
          <div class="field">
            <label for="slug">Web address</label>
            ${isNew ? `<input type="text" id="slug" value="${esc(post.slug)}" placeholder="auto from title" />` : ''}
            <span class="slug-prev" id="slug-prev">fahamlaw.com/insights/${esc(post.slug)}</span>
          </div>
          <div class="field">
            <label for="desc">Summary (for Google and link previews)</label>
            <textarea id="desc" rows="3" maxlength="320">${esc(post.description)}</textarea>
            <span class="counter" id="desc-count"></span>
          </div>
        </div>

        <div class="card">
          <h3>Cover image</h3>
          <div class="cover-box" id="cover-box" role="button" tabindex="0" aria-label="Choose cover image"></div>
          <div class="field" id="alt-field"><label for="alt">Image description (alt text)</label><input type="text" id="alt" value="${esc(post.coverAlt)}" placeholder="e.g. Signing documents at a closing" /></div>
          <button class="btn btn-ghost btn-sm" id="cover-remove" type="button">Remove cover</button>
        </div>

        ${isNew ? '' : `<button class="btn btn-danger" id="del" type="button">Delete post</button>`}
      </aside>
    </div>`;

  // Title autosize
  const titleEl = $('#title') as HTMLTextAreaElement;
  const autosize = () => { titleEl.style.height = 'auto'; titleEl.style.height = titleEl.scrollHeight + 'px'; };
  autosize();
  document.fonts?.ready.then(autosize);
  window.addEventListener('resize', autosize);

  // Editor
  const editor = new Editor({
    element: $('#editor'),
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false, codeBlock: false, underline: false, strike: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: 'Start writing… Paste from Word or Google Docs works too.' }),
    ],
    content: toEditorHtml(post.body),
    onUpdate: () => markDirty(),
    onSelectionUpdate: () => syncToolbar(),
    onTransaction: () => syncToolbar(),
  });

  function syncToolbar() {
    const map: Record<string, boolean> = {
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      link: editor.isActive('link'),
      ul: editor.isActive('bulletList'),
      ol: editor.isActive('orderedList'),
      quote: editor.isActive('blockquote'),
    };
    $$('#tb [data-cmd]').forEach((b) => b.classList.toggle('on', Boolean(map[b.dataset.cmd!])));
  }

  async function insertImage() {
    const file = await pickFile();
    if (!file) return;
    try {
      toast('Uploading image…');
      const up = await fileToUpload(file);
      const res = await api<{ path: string; sha: string }>('upload', { method: 'POST', body: { name: up.name, ext: up.ext, data: up.data } });
      const url = URL.createObjectURL(up.blob);
      uploads.set(res.path, { sha: res.sha, url });
      const m = await modal({ title: 'Describe this image', ok: 'Insert', fields: [{ name: 'alt', label: 'Image description (alt text)', hint: 'Helps accessibility and Google. e.g. "Commercial lease on a desk"' }] });
      editor.chain().focus().setImage({ src: url, alt: m?.alt || '' }).run();
      toast('Image added. It will be saved with the post.');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  async function setLink() {
    const prev = editor.getAttributes('link').href || '';
    const m = await modal({ title: prev ? 'Edit link' : 'Add link', ok: 'Save', fields: [{ name: 'href', label: 'Web address', value: prev, hint: 'Leave empty to remove the link. Use /contact for pages on this site.' }] });
    if (!m) return;
    const href = m.href.trim();
    if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  $$('#tb [data-cmd]').forEach((b) => b.addEventListener('click', () => {
    const c = editor.chain().focus();
    switch (b.dataset.cmd) {
      case 'p': c.setParagraph().run(); break;
      case 'h2': c.toggleHeading({ level: 2 }).run(); break;
      case 'h3': c.toggleHeading({ level: 3 }).run(); break;
      case 'bold': c.toggleBold().run(); break;
      case 'italic': c.toggleItalic().run(); break;
      case 'ul': c.toggleBulletList().run(); break;
      case 'ol': c.toggleOrderedList().run(); break;
      case 'quote': c.toggleBlockquote().run(); break;
      case 'hr': c.setHorizontalRule().run(); break;
      case 'undo': c.undo().run(); break;
      case 'redo': c.redo().run(); break;
      case 'link': setLink(); break;
      case 'image': insertImage(); break;
    }
  }));

  // Fields
  const slugEl = document.getElementById('slug') as HTMLInputElement | null;
  const slugPrev = $('#slug-prev');
  const descEl = $('#desc') as HTMLTextAreaElement;
  const updateSlug = () => {
    if (!isNew) return;
    if (!slugTouched) slugEl!.value = slugify(titleEl.value);
    post.slug = slugify(slugEl!.value);
    slugPrev.textContent = `fahamlaw.com/insights/${post.slug || '…'}`;
  };
  const updateCount = () => {
    const n = descEl.value.length;
    const c = $('#desc-count');
    c.textContent = `${n} characters · aim for 120–160`;
    c.classList.toggle('over', n > 160);
  };
  titleEl.addEventListener('input', () => { autosize(); updateSlug(); markDirty(); });
  titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); editor.commands.focus('start'); } });
  slugEl?.addEventListener('input', () => { slugTouched = slugEl.value.trim() !== ''; updateSlug(); markDirty(); });
  descEl.addEventListener('input', () => { updateCount(); markDirty(); });
  $('#cat').addEventListener('change', markDirty);
  $('#date').addEventListener('change', markDirty);
  $('#alt').addEventListener('input', markDirty);
  updateSlug();
  updateCount();

  // Cover
  const coverBox = $('#cover-box');
  const drawCover = () => {
    coverBox.innerHTML = post.cover ? `<img src="${esc(displaySrc(post.cover))}" alt="" />` : `<span>Click to add a cover image<br><small>Wide images work best (16:9)</small></span>`;
    $('#cover-remove').style.display = post.cover ? '' : 'none';
    $('#alt-field').style.display = post.cover ? '' : 'none';
  };
  const chooseCover = async () => {
    const file = await pickFile();
    if (!file) return;
    try {
      coverBox.innerHTML = `<span class="spinner"></span>`;
      const up = await fileToUpload(file);
      const res = await api<{ path: string; sha: string }>('upload', { method: 'POST', body: { name: up.name, ext: up.ext, data: up.data } });
      uploads.set(res.path, { sha: res.sha, url: URL.createObjectURL(up.blob) });
      post.cover = res.path;
      markDirty();
    } catch (e) {
      toast((e as Error).message, true);
    }
    drawCover();
  };
  coverBox.addEventListener('click', chooseCover);
  coverBox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseCover(); } });
  $('#cover-remove').addEventListener('click', () => { post.cover = ''; markDirty(); drawCover(); });
  drawCover();

  // Buttons
  function drawButtons() {
    const live = !isNew && !post.draft;
    $('#save-btns').innerHTML = live
      ? `<button class="btn btn-ghost" data-save="draft" type="button">Unpublish</button><button class="btn" data-save="live" type="button">Update</button>`
      : `<button class="btn btn-ghost" data-save="draft" type="button">Save draft</button><button class="btn btn-brass" data-save="live" type="button">Publish</button>`;
    $$('[data-save]').forEach((b) => b.addEventListener('click', () => save(b.dataset.save === 'draft')));
  }
  drawButtons();

  function markDirty() {
    if (!dirty) {
      dirty = true;
      $('#dirty').textContent = 'Unsaved changes';
    }
  }
  leaveGuard = (silent?: boolean) => !dirty || saving || (silent === true ? false : confirm('You have unsaved changes. Leave without saving?'));

  async function save(asDraft: boolean) {
    if (saving) return;
    const liveNow = !isNew && !post.draft;
    if (asDraft && liveNow && !confirm('Unpublish this post? It will be removed from the website but kept here as a draft.')) return;
    const data = {
      slug: isNew ? post.slug : post.slug,
      title: titleEl.value.trim(),
      description: descEl.value.trim(),
      date: ($('#date') as HTMLInputElement).value,
      category: ($('#cat') as HTMLSelectElement).value,
      cover: post.cover,
      coverAlt: ($('#alt') as HTMLInputElement).value.trim(),
      draft: asDraft,
      updated: liveNow && !asDraft ? today() : post.updated || '',
      body: fromEditorHtml(editor.getHTML()),
    };
    if (data.updated && data.updated <= data.date) data.updated = '';
    const errBox = $('#save-err');
    errBox.innerHTML = '';
    if (!data.title) return (errBox.innerHTML = `<div class="err">Add a title.</div>`), titleEl.focus();
    if (!data.slug) return (errBox.innerHTML = `<div class="err">Add a web address.</div>`);
    if (!asDraft) {
      if (!data.category) return (errBox.innerHTML = `<div class="err">Choose a category before publishing.</div>`);
      if (!data.description) return (errBox.innerHTML = `<div class="err">Add a summary before publishing.</div>`), descEl.focus();
    } else {
      data.category ||= Object.keys(CATEGORIES)[0] || '';
      data.description ||= data.title;
    }
    if (data.cover && !data.coverAlt && !asDraft) return (errBox.innerHTML = `<div class="err">Describe the cover image (alt text).</div>`);

    saving = true;
    $$('[data-save]').forEach((b) => ((b as HTMLButtonElement).disabled = true));
    const btn = $(`[data-save="${asDraft ? 'draft' : 'live'}"]`);
    const label = btn.textContent;
    btn.innerHTML = `<span class="spinner"></span>`;
    try {
      const res = await api<{ post: any; deploys: boolean }>('posts', {
        method: 'PUT',
        body: { post: data, isNew, baseSha, uploads: [...uploads].map(([path, u]) => ({ path, sha: u.sha })) },
      });
      dirty = false;
      saving = false;
      leaveGuard = null;
      toast(asDraft ? (liveNow ? 'Unpublished. The site will update in about a minute.' : 'Draft saved.') : 'Published! The site will update in about 1–2 minutes.');
      const target = `#/posts/edit/${encodeURIComponent(res.post.slug)}`;
      if (location.hash === target) renderEditor(res.post.slug);
      else location.hash = target;
    } catch (e) {
      saving = false;
      errBox.innerHTML = `<div class="err">${esc((e as Error).message)}</div>`;
      $$('[data-save]').forEach((b) => ((b as HTMLButtonElement).disabled = false));
      btn.textContent = label;
    }
  }

  document.getElementById('del')?.addEventListener('click', async () => {
    if (!confirm(`Delete "${post.title}"? This removes it from the website and from the admin.`)) return;
    try {
      await api(`posts/${encodeURIComponent(post.slug)}`, { method: 'DELETE' });
      dirty = false;
      leaveGuard = null;
      toast('Post deleted.');
      location.hash = '#/posts';
    } catch (e) {
      toast((e as Error).message, true);
    }
  });

  // Ctrl/Cmd+S saves (as draft unless already live)
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save(isNew || post.draft);
    }
  };
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => { document.removeEventListener('keydown', onKey); editor.destroy(); }, { once: true });
}

/* ---------------- Inquiries ---------------- */
async function renderInquiries(form: FormName) {
  shell('inq', `
    <div class="page-head"><div><h1>Inquiries</h1><p>Messages from the website's forms. Email notifications go to the address set in Netlify.</p></div>
      <button class="btn btn-ghost" id="csv" type="button" disabled>Export CSV</button></div>
    ${session?.netlify ? '' : setupWarnings()}
    <div class="filters">
      <div class="seg">${(Object.keys(FORMS) as FormName[]).map((f) => `<a href="#/inquiries/${f}" class="${f === form ? 'on' : ''}">${FORMS[f].label}</a>`).join('')}</div>
      <input type="search" id="q" placeholder="Search name, email, text…" aria-label="Search inquiries" />
    </div>
    <section class="card" id="ilist"><div class="loading"><span class="spinner"></span></div></section>`);
  if (!session?.netlify) {
    $('#ilist').innerHTML = `<div class="empty">Not connected yet.</div>`;
    return;
  }
  let subs: any[] = [];
  try {
    subs = (await api<{ submissions: any[] }>(`submissions?form=${form}`)).submissions;
  } catch (e) {
    $('#ilist').innerHTML = `<div class="empty">${esc((e as Error).message)}</div>`;
    return;
  }
  subs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const fields = FORMS[form].fields;
  const val = (v: any) => (v && typeof v === 'object' ? v.filename || 'file' : String(v ?? ''));
  const cols = form === 'contact'
    ? [['Received', (s: any) => fmtDate(s.created_at)], ['Name', (s: any) => `${s.data.first_name || ''} ${s.data.last_name || ''}`], ['Email', (s: any) => s.data.email], ['Reason', (s: any) => s.data.reason], ['Message', (s: any) => s.data.message]]
    : [['Received', (s: any) => fmtDate(s.created_at)], ['Owner', (s: any) => s.data.owner_name], ['Mark', (s: any) => s.data.mark_words], ['Email', (s: any) => s.data.email], ['Goods / services', (s: any) => s.data.goods_services]];

  const csvBtn = $('#csv') as HTMLButtonElement;
  csvBtn.disabled = !subs.length;
  csvBtn.addEventListener('click', () => {
    const header = ['Submitted', ...fields.map((f) => f[1])];
    const rows = subs.map((s) => [new Date(s.created_at).toLocaleString('en-US'), ...fields.map(([k]) => {
      const v = s.data[k];
      return v && typeof v === 'object' ? v.url : val(v);
    })]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `fahamlaw-${form}-inquiries-${today()}.csv`;
    a.click();
  });

  const draw = (q = '') => {
    const needle = q.trim().toLowerCase();
    const list = needle ? subs.filter((s) => JSON.stringify(s.data).toLowerCase().includes(needle)) : subs;
    $('#ilist').innerHTML = list.length
      ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>
          ${list.map((s) => `<tr class="click" data-id="${esc(s.id)}">${cols.map((c, i) => `<td class="${i === 1 ? 'title' : i === cols.length - 1 ? 'clip' : ''}" ${i === 0 ? 'style="white-space:nowrap"' : ''}>${esc((c[1] as any)(s))}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div>`
      : `<div class="empty">${subs.length ? 'No matches.' : `No ${FORMS[form].label.toLowerCase()} submissions yet.`}</div>`;
    $$('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => openDrawer(subs.find((s) => s.id === tr.dataset.id))));
  };
  $('#q').addEventListener('input', (e) => draw((e.target as HTMLInputElement).value));
  draw();

  function openDrawer(s: any) {
    if (!s) return;
    const name = form === 'contact' ? `${s.data.first_name || ''} ${s.data.last_name || ''}`.trim() : s.data.owner_name;
    const bg = document.createElement('div');
    bg.className = 'drawer-bg';
    const dr = document.createElement('aside');
    dr.className = 'drawer';
    dr.setAttribute('role', 'dialog');
    dr.setAttribute('aria-label', 'Inquiry details');
    const cell = (k: string, v: any) => {
      if (v && typeof v === 'object' && v.url) return `<a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.filename || 'Download file')}</a>`;
      if (k === 'email' && v) return `<a href="mailto:${esc(v)}">${esc(v)}</a>`;
      if (k === 'phone' && v) return `<a href="tel:${esc(String(v).replace(/[^\d+]/g, ''))}">${esc(v)}</a>`;
      return esc(v) || '<span class="muted">—</span>';
    };
    dr.innerHTML = `
      <div class="drawer-h"><div><p class="muted" style="margin:0 0 4px;font-size:.82rem">${esc(FORMS[form].label)} · ${esc(fmtDateTime(s.created_at))}</p><h2>${esc(name || s.data.email)}</h2></div>
        <button class="btn btn-ghost btn-sm" data-close type="button">Close</button></div>
      <div class="drawer-b">
        <dl>${fields.map(([k, l]) => `<div class="kv"><dt>${esc(l)}</dt><dd>${cell(k, s.data[k])}</dd></div>`).join('')}</dl>
        ${s.data.email ? `<div class="row" style="margin-top:20px"><a class="btn" href="mailto:${esc(s.data.email)}?subject=${encodeURIComponent('Re: your inquiry to Faham Law')}">Reply by email</a>${s.data.phone ? `<a class="btn btn-ghost" href="tel:${esc(String(s.data.phone).replace(/[^\d+]/g, ''))}">Call</a>` : ''}</div>` : ''}
      </div>`;
    document.body.append(bg, dr);
    const close = () => { bg.remove(); dr.remove(); document.removeEventListener('keydown', onEsc); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onEsc);
    bg.addEventListener('click', close);
    $('[data-close]', dr).addEventListener('click', close);
    ($('[data-close]', dr) as HTMLButtonElement).focus();
  }

  const wanted = new URLSearchParams(location.hash.split('?')[1] || '').get('id');
  if (wanted) openDrawer(subs.find((s) => s.id === wanted));
}

boot();

/* ---------------- Site content editor ---------------- */
type FieldType = 'text' | 'textarea' | 'bool' | 'number' | 'image' | 'select' | 'link' | 'object' | 'list' | 'strings';
type Field = {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  big?: boolean;
  fields?: Field[];
  itemLabel?: (item: any, i: number) => string;
  itemName?: string;
  options?: () => { value: string; label: string }[];
  optional?: boolean;
};
type Section = { id: string; label: string; path: string; intro?: string; fields: Field[] };

const EMPH = undefined;
const t = (key: string, label: string, hint?: string): Field => ({ key, label, type: 'text', hint });
const ta = (key: string, label: string, hint?: string, big = false): Field => ({ key, label, type: 'textarea', hint, big });
const link = (key: string, label: string, hint?: string, optional = false): Field => ({
  key, label, type: 'link', hint, optional,
  fields: [t('label', 'Button text'), t('href', 'Link', 'A page on this site like /contact or /fees, or a full https:// address.')],
});
const seo = (): Field[] => [
  t('seoTitle', 'Browser / Google title', 'Shown in the browser tab and as the headline in Google results. Aim for under 60 characters.'),
  ta('seoDescription', 'Google description', 'The grey text under the title in search results. Aim for 120 to 160 characters.'),
];
const practiceOptions = () => ((siteModel?.practices as any[]) || []).map((p) => ({ value: p.slug, label: p.name }));

const SITE_SECTIONS: Section[] = [
  {
    id: 'firm', label: 'Firm & contact details', path: 'firm',
    intro: 'Used across the site: header, footer, contact page and the structured data Google reads.',
    fields: [
      t('name', 'Firm name'), t('shortName', 'Short name'), t('tagline', 'Tagline'),
      t('partner', 'Partner name'), t('partnerTitle', 'Partner title'),
      { key: 'since', label: 'Founded (year)', type: 'number' },
      t('phone', 'Phone'), t('email', 'Email'), t('url', 'Website address', 'Used for links in search results and social previews.'),
      t('hourlyRate', 'Hourly rate', 'Shown in structured data as the price range, e.g. $495'),
      {
        key: 'offices', label: 'Offices', type: 'list', itemName: 'office',
        hint: 'The first office is the principal office shown in the footer. Leave street and ZIP empty to list a city only.',
        itemLabel: (o) => o.label || o.city || 'Office',
        fields: [t('label', 'Short label', 'e.g. Oakhurst, NJ'), t('street', 'Street address'), t('city', 'City'), t('state', 'State'), t('zip', 'ZIP')],
      },
      t('licensed', 'Licensing line', 'e.g. Licensed in New York, New Jersey & Pennsylvania'),
      t('linkedinFirm', 'Firm LinkedIn URL'), t('linkedinDavid', "Partner's LinkedIn URL"),
      ta('blurb', 'Firm description', 'One or two sentences, used in the footer and in search results.'),
      ta('disclaimer', 'Legal disclaimer', 'Shown in the footer on every page.'),
      ta('fees', 'Fee philosophy', 'Short paragraph about how fees work. Used where a general statement is needed.'),
    ],
  },
  {
    id: 'settings', label: 'Settings & images', path: 'settings',
    fields: [
      { key: 'showTestimonials', label: 'Show testimonials on the site', type: 'bool', hint: 'Turn off to hide the testimonials section and page. Before showing a testimonial, confirm you have the client\'s written permission (NY Rule 7.1).' },
      { key: 'showInsights', label: 'Show the Insights link in the menu', type: 'bool', hint: 'Insights appears automatically once a post is published. Turn this on to show it earlier.' },
      { key: 'headshot', label: "David's photo", type: 'image', hint: 'Portrait orientation works best (about 1000 × 1500 pixels).' },
      t('headshotAlt', 'Photo description (alt text)'),
      link('headerCta', 'Header button', 'The button at the top right of every page.'),
    ],
  },
  {
    id: 'home', label: 'Home page', path: 'home',
    fields: [
      ...seo(),
      t('eyebrow', 'Small line above the headline'), t('kicker', 'Small line at the right'),
      ta('title', 'Headline', EMPH), ta('lead', 'Intro paragraph'),
      link('primaryCta', 'Main button'), link('secondaryCta', 'Second button'),
      t('routerTitle', 'Title of the "Where is your business today?" box'),
      {
        key: 'stages', label: '"Where is your business today?" rows', type: 'list', itemName: 'row',
        hint: 'The first row decides which practice area is featured in the big dark section below the headline.',
        itemLabel: (s) => s.need || 'Row',
        fields: [t('need', 'Situation', 'e.g. Growing without an in-house lawyer'), { key: 'slug', label: 'Practice area', type: 'select', options: practiceOptions }],
      },
      {
        key: 'gc', label: 'Featured practice section (dark band)', type: 'object',
        fields: [
          t('eyebrow', 'Small line'), ta('title', 'Headline', EMPH), ta('lead', 'Intro'),
          { key: 'points', label: 'Points', type: 'list', itemName: 'point', itemLabel: (p) => p.title || 'Point', fields: [t('title', 'Title'), ta('text', 'Text')] },
          link('cta', 'Button'),
        ],
      },
      t('practicesEyebrow', 'Practice areas: small line'), ta('practicesTitle', 'Practice areas: headline', EMPH),
      t('industriesLabel', 'Industries label'),
      {
        key: 'trademark', label: 'Trademark strip', type: 'object',
        fields: [t('eyebrow', 'Small line'), ta('title', 'Headline', EMPH), ta('text', 'Text'), link('primaryCta', 'Main button'), link('secondaryCta', 'Second button')],
      },
      {
        key: 'about', label: 'Meet the partner', type: 'object',
        fields: [
          t('eyebrow', 'Small line'), ta('lead', 'Paragraph'),
          { key: 'creds', label: 'Credentials', type: 'list', itemName: 'credential', itemLabel: (c) => c.label || 'Credential', fields: [t('label', 'Label'), t('value', 'Value')] },
          t('cta', 'Link text'),
        ],
      },
      t('testimonialsEyebrow', 'Testimonials: small line'), t('testimonialsTitle', 'Testimonials: headline', EMPH),
      { key: 'contact', label: 'Contact section', type: 'object', fields: [t('eyebrow', 'Small line'), ta('title', 'Headline', EMPH), ta('lead', 'Text')] },
    ],
  },
  {
    id: 'practices', label: 'Practice areas', path: 'practices',
    intro: 'Each practice area is its own page, listed in the menu, the footer and the practice areas page in this order. Drag order with the arrows.',
    fields: [
      {
        key: '', label: 'Practice areas', type: 'list', itemName: 'practice area',
        itemLabel: (p) => p.name || 'New practice area',
        fields: [
          t('name', 'Name'),
          t('slug', 'Web address', 'Lowercase letters, numbers and hyphens. The page lives at fahamlaw.com/this-address. Changing it breaks old links.'),
          ta('short', 'Short description', 'Shown on the home page and the practice areas list.'),
          ...seo(),
          ta('h1', 'Page headline', EMPH), ta('intro', 'Intro paragraph', undefined, true),
          {
            key: 'groups', label: 'Sections', type: 'list', itemName: 'section', itemLabel: (g) => g.title || 'Section',
            fields: [
              t('title', 'Section title', 'e.g. What we handle'), ta('note', 'Note under the title (optional)'),
              { key: 'items', label: 'Items', type: 'list', itemName: 'item', itemLabel: (it) => it.label || (it.text || '').slice(0, 50) || 'Item', fields: [t('label', 'Label (optional)'), ta('text', 'Text')] },
            ],
          },
          ta('who', 'Who we work with', 'Leave empty to hide this section.'),
          { key: 'faqs', label: 'Common questions', type: 'list', itemName: 'question', itemLabel: (q) => q.q || 'Question', fields: [t('q', 'Question'), ta('a', 'Answer')] },
          ta('cta', 'Call to action', 'The headline of the dark box at the bottom of the page.'),
          link('ctaSecondary', 'Second button in the call to action', 'Leave both empty for a "Call" button instead.', true),
        ],
      },
    ],
  },
  {
    id: 'fees', label: 'Fees page', path: 'fees',
    fields: [
      ...seo(), t('eyebrow', 'Small line'), ta('title', 'Headline', EMPH), ta('lead', 'Intro'),
      { key: 'hourly', label: 'Hourly card', type: 'object', fields: [t('label', 'Label'), t('value', 'Big text'), ta('text', 'Text')] },
      { key: 'retainer', label: 'Retainer card', type: 'object', fields: [t('label', 'Label'), t('value', 'Big text'), ta('text', 'Text'), link('cta', 'Link')] },
      { key: 'columns', label: 'Table column headings', type: 'strings', hint: 'Three headings: service, your fee, government fee.' },
      {
        key: 'sections', label: 'Fee tables', type: 'list', itemName: 'table', itemLabel: (s) => s.title || 'Table',
        fields: [
          t('title', 'Title', 'e.g. Trademarks'),
          {
            key: 'groups', label: 'Groups', type: 'list', itemName: 'group', itemLabel: (g) => g.title || 'Rows',
            fields: [
              t('title', 'Group title (optional)', 'e.g. Searching'),
              { key: 'rows', label: 'Rows', type: 'list', itemName: 'row', itemLabel: (r) => r.service || 'Row', fields: [t('service', 'Service'), t('fee', 'Our fee'), t('gov', 'Government fee', 'Leave empty for a dash.')] },
            ],
          },
        ],
      },
      ta('footnote', 'Footnote', undefined, true), ta('cta', 'Call to action headline'),
    ],
  },
  {
    id: 'about', label: 'About page', path: 'about',
    fields: [
      ...seo(), t('title', 'Headline', EMPH), ta('lead', 'Intro'),
      { key: 'bio', label: 'Biography paragraphs', type: 'strings', big: true, itemName: 'paragraph' },
      ta('personal', 'Personal note', 'Shown as a pull quote. Leave empty to hide.'),
      { key: 'education', label: 'Education', type: 'list', itemName: 'school', itemLabel: (e) => e.school || 'School', fields: [t('school', 'School'), t('degree', 'Degree and year')] },
      { key: 'barAdmissions', label: 'Bar admissions', type: 'strings', itemName: 'state' },
      { key: 'licenses', label: 'Licenses', type: 'list', itemName: 'license', itemLabel: (l) => l.label || 'License', fields: [t('label', 'License'), t('value', 'Where')] },
    ],
  },
  {
    id: 'services', label: 'Practice areas page', path: 'services',
    fields: [...seo(), t('eyebrow', 'Small line'), t('title', 'Headline', EMPH), ta('lead', 'Intro'), t('notSureTitle', '"Not sure" box: title'), ta('notSureText', '"Not sure" box: text')],
  },
  {
    id: 'contact', label: 'Contact page', path: 'contact',
    fields: [
      ...seo(), t('eyebrow', 'Small line'), t('title', 'Headline', EMPH), ta('lead', 'Intro'),
      t('formHeading', 'Form heading'), t('formPill', 'Form badge'),
      t('feesLabel', 'Fees box: label'), ta('feesText', 'Fees box: text'), link('feesCta', 'Fees box: link'),
    ],
  },
  {
    id: 'lists', label: 'Testimonials & lists', path: '',
    fields: [
      {
        key: 'testimonials', label: 'Testimonials', type: 'list', itemName: 'testimonial', itemLabel: (x) => x.name || 'Testimonial',
        hint: 'Get written permission from each client before publishing their name (NY Rule 7.1). The first one is featured on the home page.',
        fields: [ta('quote', 'Quote', undefined, true), t('name', 'Name'), t('role', 'Title and company')],
      },
      { key: 'industries', label: 'Industries we serve', type: 'strings', itemName: 'industry' },
      { key: 'inquiryReasons', label: 'Contact form: "Reason of inquiry" options', type: 'strings', itemName: 'option' },
    ],
  },
];

let siteModel: any = null;
let siteSha = '';
let siteDirty = false;
let siteSaving = false;
const siteUploads = new Map<string, { sha: string; url: string }>();
const siteOpen = new Set<string>();

const P = (path: string) => path.split('/').filter((x) => x !== '');
function getAt(obj: any, path: string) { return P(path).reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setAt(obj: any, path: string, value: any) {
  const keys = P(path);
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys[keys.length - 1]] = value;
}
const joinPath = (a: string, b: string | number) => (a ? `${a}/${b}` : String(b));

function defaultFor(f: Field): any {
  switch (f.type) {
    case 'bool': return false;
    case 'number': return 0;
    case 'list': case 'strings': return [];
    case 'link': return { label: '', href: '' };
    case 'object': return Object.fromEntries((f.fields || []).map((x) => [x.key, defaultFor(x)]));
    default: return '';
  }
}
const defaultItem = (f: Field) => (f.type === 'strings' ? '' : Object.fromEntries((f.fields || []).map((x) => [x.key, defaultFor(x)])));

const siteImgSrc = (p: string) => siteUploads.get(p)?.url ?? (p.startsWith('/uploads/') ? `/api/media?path=${encodeURIComponent(p)}` : p);
const idFor = (path: string) => 'f-' + path.replace(/[^a-z0-9]+/gi, '-');

function fieldHtml(f: Field, value: any, path: string): string {
  const id = idFor(path);
  const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
  switch (f.type) {
    case 'text':
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><input type="text" id="${id}" data-path="${esc(path)}" value="${esc(value ?? '')}" />${hint}</div>`;
    case 'number':
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><input type="number" id="${id}" data-path="${esc(path)}" data-type="number" value="${esc(value ?? '')}" />${hint}</div>`;
    case 'textarea':
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><textarea id="${id}" data-path="${esc(path)}" rows="${f.big ? 8 : 3}">${esc(value ?? '')}</textarea>${hint}</div>`;
    case 'bool':
      return `<div class="field"><label class="switch"><input type="checkbox" data-path="${esc(path)}" data-type="bool" ${value ? 'checked' : ''} /><span>${esc(f.label)}</span></label>${hint}</div>`;
    case 'select': {
      const opts = (f.options?.() || []).map((o) => `<option value="${esc(o.value)}" ${o.value === value ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><select id="${id}" data-path="${esc(path)}">${opts}</select>${hint}</div>`;
    }
    case 'image':
      return `<div class="field"><span class="label">${esc(f.label)}</span>
        <div class="img-field">${value ? `<img src="${esc(siteImgSrc(value))}" alt="" />` : '<span class="muted">No image</span>'}
          <div class="row" style="flex:0"><button type="button" class="btn btn-ghost btn-sm" data-img-pick="${esc(path)}">${value ? 'Replace image' : 'Upload image'}</button></div>
        </div>${hint}</div>`;
    case 'link': {
      const v = value || { label: '', href: '' };
      return `<fieldset class="obj obj-link"><legend>${esc(f.label)}</legend><div class="form-row">${(f.fields || []).map((x) => fieldHtml(x, v[x.key], joinPath(path, x.key))).join('')}</div>${hint}</fieldset>`;
    }
    case 'object':
      return `<fieldset class="obj"><legend>${esc(f.label)}</legend>${hint}${(f.fields || []).map((x) => fieldHtml(x, value?.[x.key], joinPath(path, x.key))).join('')}</fieldset>`;
    case 'strings': {
      const arr: string[] = Array.isArray(value) ? value : [];
      const rows = arr.map((s, i) => {
        const p = joinPath(path, i);
        const ctl = `<span class="row-ctl"><button type="button" title="Move up" data-act="up" data-list="${esc(path)}" data-i="${i}">↑</button><button type="button" title="Move down" data-act="down" data-list="${esc(path)}" data-i="${i}">↓</button><button type="button" title="Remove" data-act="remove" data-list="${esc(path)}" data-i="${i}">✕</button></span>`;
        return `<div class="srow">${f.big ? `<textarea data-path="${esc(p)}" rows="5">${esc(s)}</textarea>` : `<input type="text" data-path="${esc(p)}" value="${esc(s)}" />`}${ctl}</div>`;
      }).join('');
      return `<div class="field"><span class="label">${esc(f.label)}</span>${hint}<div class="strings">${rows}</div><div><button type="button" class="btn btn-ghost btn-sm" data-add="${esc(path)}">+ Add ${esc(f.itemName || 'item')}</button></div></div>`;
    }
    case 'list': {
      const arr: any[] = Array.isArray(value) ? value : [];
      const items = arr.map((item, i) => {
        const p = joinPath(path, i);
        const label = f.itemLabel ? f.itemLabel(item, i) : `${f.itemName || 'Item'} ${i + 1}`;
        return `<details class="item" data-item="${esc(p)}" ${siteOpen.has(p) ? 'open' : ''}>
          <summary><span class="item-n">${i + 1}</span><span class="item-t">${esc(label)}</span>
            <span class="row-ctl"><button type="button" title="Move up" data-act="up" data-list="${esc(path)}" data-i="${i}">↑</button><button type="button" title="Move down" data-act="down" data-list="${esc(path)}" data-i="${i}">↓</button><button type="button" title="Remove" data-act="remove" data-list="${esc(path)}" data-i="${i}">✕</button></span>
          </summary>
          <div class="item-b">${(f.fields || []).map((x) => fieldHtml(x, item?.[x.key], joinPath(p, x.key))).join('')}</div>
        </details>`;
      }).join('');
      return `<div class="field list-field"><span class="label">${esc(f.label)}</span>${hint}<div class="items">${items || '<p class="muted" style="margin:0">None yet.</p>'}</div><div><button type="button" class="btn btn-ghost btn-sm" data-add="${esc(path)}">+ Add ${esc(f.itemName || 'item')}</button></div></div>`;
    }
  }
}

function findField(path: string): Field | null {
  // Walks SITE_SECTIONS to find the field definition for a list path (used for adding items).
  const keys = P(path);
  for (const sec of SITE_SECTIONS) {
    const base = P(sec.path);
    if (base.some((k, i) => keys[i] !== k)) continue;
    let rest = keys.slice(base.length);
    let fields = sec.fields;
    let found: Field | null = null;
    while (fields) {
      const f = fields.find((x) => x.key === '' || x.key === rest[0]) || null;
      if (!f) break;
      if (f.key !== '') rest = rest.slice(1);
      found = f;
      if (rest.length === 0) return f;
      if (f.type === 'list') { rest = rest.slice(1); fields = f.fields!; if (rest.length === 0) return null; continue; }
      if (f.type === 'object' || f.type === 'link') { fields = f.fields!; continue; }
      break;
    }
    if (found && rest.length === 0) return found;
  }
  return null;
}

function normalizeSite(model: any) {
  const m = JSON.parse(JSON.stringify(model));
  m.firm.since = Number(m.firm.since) || m.firm.since;
  for (const p of m.practices || []) {
    if (p.ctaSecondary && !p.ctaSecondary.label?.trim() && !p.ctaSecondary.href?.trim()) p.ctaSecondary = null;
    p.slug = slugify(p.slug || p.name || '');
  }
  return m;
}

async function renderSite(sectionId: string) {
  const sec = SITE_SECTIONS.find((s) => s.id === sectionId) || SITE_SECTIONS[0];
  if (sec.id !== sectionId) { location.hash = `#/site/${sec.id}`; return; }
  shell('site', `<div class="loading"><span class="spinner"></span>Loading…</div>`);
  if (session?.mode === 'unconfigured') { $('main.wrap').innerHTML = setupWarnings(); return; }
  if (!siteModel || !siteDirty) {
    try {
      const res = await api<{ content: any; sha: string }>('site');
      siteModel = res.content;
      siteSha = res.sha;
      siteDirty = false;
    } catch (e) {
      $('main.wrap').innerHTML = `<div class="empty">${esc((e as Error).message)}</div>`;
      return;
    }
  }
  leaveGuard = (silent?: boolean) => !siteDirty || siteSaving || location.hash.startsWith('#/site') || (silent === true ? false : confirm('You have unsaved site changes. Leave without saving?'));

  $('main.wrap').innerHTML = `
    <div class="page-head"><div><h1>Site content</h1><p>Every word, list and image on fahamlaw.com. Saving publishes in about 1–2 minutes.</p></div></div>
    ${setupWarnings()}
    <div class="site-layout">
      <nav class="site-nav card" aria-label="Site sections"><ul>${SITE_SECTIONS.map((s) => `<li><a href="#/site/${s.id}" class="${s.id === sec.id ? 'on' : ''}">${esc(s.label)}</a></li>`).join('')}</ul></nav>
      <div class="site-main">
        <section class="card site-card">
          <div class="panel-h"><h2>${esc(sec.label)}</h2>${sec.intro ? `<span class="muted" style="font-size:.85rem">${esc(sec.intro)}</span>` : ''}</div>
          <form class="site-form" id="site-form" autocomplete="off"></form>
        </section>
      </div>
    </div>
    <div class="savebar" id="savebar">
      <span id="site-dirty" class="muted">${siteDirty ? 'Unsaved changes' : 'All changes saved'}</span>
      <input type="text" id="site-summary" placeholder="What changed? (optional, shown in the update history)" />
      <div id="site-err"></div>
      <button type="button" class="btn" id="site-save" ${siteDirty ? '' : 'disabled'}>Save &amp; publish</button>
    </div>`;

  const form = $('#site-form') as HTMLFormElement;
  const draw = () => {
    const scroll = window.scrollY;
    const base = getAt(siteModel, sec.path) ?? siteModel;
    form.innerHTML = sec.fields.map((f) => fieldHtml(f, f.key === '' ? base : base?.[f.key], f.key === '' ? sec.path : joinPath(sec.path, f.key))).join('');
    window.scrollTo(0, scroll);
  };
  const setDirty = () => {
    if (!siteDirty) { siteDirty = true; $('#site-dirty').textContent = 'Unsaved changes'; ($('#site-save') as HTMLButtonElement).disabled = false; }
  };
  draw();

  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    const path = el.dataset.path;
    if (!path) return;
    const v = el.dataset.type === 'bool' ? el.checked : el.dataset.type === 'number' ? Number(el.value) : el.value;
    setAt(siteModel, path, v);
    setDirty();
    // keep the collapsed summary in sync for list items
    const item = el.closest<HTMLElement>('details.item');
    if (item) {
      const f = findField(item.dataset.item!.replace(/\/\d+$/, ''));
      const idx = Number(item.dataset.item!.split('/').pop());
      const val = getAt(siteModel, item.dataset.item!);
      if (f?.itemLabel) $('.item-t', item).textContent = f.itemLabel(val, idx);
    }
  });
  form.addEventListener('toggle', (e) => {
    const d = e.target as HTMLDetailsElement;
    if (d.dataset.item) d.open ? siteOpen.add(d.dataset.item) : siteOpen.delete(d.dataset.item);
  }, true);
  form.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn) return;
    if (btn.dataset.add !== undefined) {
      const path = btn.dataset.add;
      const f = findField(path);
      if (!f) { toast('Could not add here.', true); return; }
      const arr = getAt(siteModel, path) || [];
      arr.push(defaultItem(f));
      setAt(siteModel, path, arr);
      siteOpen.add(joinPath(path, arr.length - 1));
      setDirty(); draw();
      const last = $$(`[data-item="${CSS.escape(joinPath(path, arr.length - 1))}"] input, [data-item="${CSS.escape(joinPath(path, arr.length - 1))}"] textarea`, form)[0] || $$(`.strings input, .strings textarea`, form).pop();
      (last as HTMLElement | undefined)?.focus();
      return;
    }
    if (btn.dataset.act) {
      const path = btn.dataset.list!;
      const i = Number(btn.dataset.i);
      const arr: any[] = getAt(siteModel, path) || [];
      if (btn.dataset.act === 'remove') {
        const f = findField(path);
        const label = f?.itemLabel && typeof arr[i] === 'object' ? f.itemLabel(arr[i], i) : String(arr[i] ?? '').slice(0, 60);
        if (!confirm(`Remove "${label || 'this item'}"?`)) return;
        arr.splice(i, 1);
      } else {
        const j = btn.dataset.act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        const a = joinPath(path, i), b = joinPath(path, j);
        const oa = siteOpen.has(a), ob = siteOpen.has(b);
        oa ? siteOpen.add(b) : siteOpen.delete(b);
        ob ? siteOpen.add(a) : siteOpen.delete(a);
      }
      setAt(siteModel, path, arr);
      setDirty(); draw();
      return;
    }
    if (btn.dataset.imgPick !== undefined) {
      const path = btn.dataset.imgPick;
      const file = await pickFile();
      if (!file) return;
      try {
        toast('Uploading image…');
        const up = await fileToUpload(file);
        const res = await api<{ path: string; sha: string }>('upload', { method: 'POST', body: { name: up.name, ext: up.ext, data: up.data } });
        siteUploads.set(res.path, { sha: res.sha, url: URL.createObjectURL(up.blob) });
        setAt(siteModel, path, res.path);
        setDirty(); draw();
        toast('Image added. It will be published with your next save.');
      } catch (err) {
        toast((err as Error).message, true);
      }
    }
  });

  async function saveSite() {
    if (siteSaving || !siteDirty) return;
    siteSaving = true;
    const btn = $('#site-save') as HTMLButtonElement;
    const errBox = $('#site-err');
    errBox.innerHTML = '';
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>`;
    try {
      const content = normalizeSite(siteModel);
      const res = await api<{ sha: string }>('site', {
        method: 'PUT',
        body: { content, baseSha: siteSha, summary: ($('#site-summary') as HTMLInputElement).value, uploads: [...siteUploads].map(([path, u]) => ({ path, sha: u.sha })) },
      });
      siteModel = content;
      siteSha = res.sha;
      siteDirty = false;
      siteUploads.clear();
      $('#site-dirty').textContent = 'All changes saved';
      ($('#site-summary') as HTMLInputElement).value = '';
      toast('Published! The site will update in about 1–2 minutes.');
      refreshSitePill();
      draw();
    } catch (e) {
      errBox.innerHTML = `<div class="err">${esc((e as Error).message)}</div>`;
      btn.disabled = false;
    } finally {
      siteSaving = false;
      btn.innerHTML = 'Save &amp; publish';
      btn.disabled = !siteDirty;
    }
  }
  $('#site-save').addEventListener('click', saveSite);
  const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveSite(); } };
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', onKey), { once: true });
}
