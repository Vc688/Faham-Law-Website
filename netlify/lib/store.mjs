// Content storage. In production, posts live as Markdown files in the GitHub repo and
// every save is ONE commit (post + any new images). Draft saves use "[skip netlify]" so
// they don't trigger a deploy (and don't spend Netlify credits).
// Local testing: set ADMIN_MOCK=1 to use the local filesystem instead of GitHub.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const env = (k) => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k] ?? '').trim();

export const POSTS_DIR = 'src/content/insights';
export const UPLOADS_DIR = 'public/uploads';

export function storeMode() {
  if (env('ADMIN_MOCK') === '1') return 'mock';
  return env('GITHUB_TOKEN') && env('GITHUB_REPO') ? 'github' : 'unconfigured';
}

/* ---------------- GitHub ---------------- */
function gh() {
  const token = env('GITHUB_TOKEN');
  const repo = env('GITHUB_REPO').replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  const branch = env('GITHUB_BRANCH') || 'main';
  async function call(method, url, body) {
    const res = await fetch(`https://api.github.com/repos/${repo}${url}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'fahamlaw-admin',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text();
      const err = new Error(`GitHub ${method} ${url} failed: ${res.status} ${text.slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? {} : res.json();
  }
  return { call, branch, repo };
}

async function ghListDir(dir) {
  const { call, branch } = gh();
  const items = await call('GET', `/contents/${dir}?ref=${encodeURIComponent(branch)}`);
  return Array.isArray(items) ? items : [];
}

async function ghReadBlob(sha) {
  const { call } = gh();
  const blob = await call('GET', `/git/blobs/${sha}`);
  return blob ? Buffer.from(blob.content, 'base64') : null;
}

async function ghFileMeta(filePath) {
  const { call, branch } = gh();
  return call('GET', `/contents/${filePath}?ref=${encodeURIComponent(branch)}`);
}

async function ghCommit(changes, message) {
  // changes: [{ path, content?: string, sha?: blobSha, delete?: true }]
  const { call, branch } = gh();
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await call('GET', `/git/ref/heads/${encodeURIComponent(branch)}`);
    if (!ref) throw new Error(`Branch "${branch}" not found in repo.`);
    const parent = ref.object.sha;
    const commit = await call('GET', `/git/commits/${parent}`);
    const tree = await call('POST', '/git/trees', {
      base_tree: commit.tree.sha,
      tree: changes.map((c) =>
        c.delete
          ? { path: c.path, mode: '100644', type: 'blob', sha: null }
          : c.sha
            ? { path: c.path, mode: '100644', type: 'blob', sha: c.sha }
            : { path: c.path, mode: '100644', type: 'blob', content: c.content },
      ),
    });
    const created = await call('POST', '/git/commits', { message, tree: tree.sha, parents: [parent] });
    try {
      await call('PATCH', `/git/refs/heads/${encodeURIComponent(branch)}`, { sha: created.sha, force: false });
      return created.sha;
    } catch (e) {
      if (e.status === 422 && attempt < 2) continue; // someone else committed; retry on new head
      throw e;
    }
  }
}

async function ghCreateBlob(buf) {
  const { call } = gh();
  const blob = await call('POST', '/git/blobs', { content: buf.toString('base64'), encoding: 'base64' });
  return blob.sha;
}

/* ---------------- Mock (local filesystem) ---------------- */
const MOCK_ROOT = () => path.resolve(env('ADMIN_MOCK_ROOT') || '.');
const mockBlobs = () => path.join(MOCK_ROOT(), '.mock-blobs');
const blobSha = (buf) => createHash('sha1').update(buf).digest('hex');

async function mockListDir(dir) {
  try {
    const names = await fs.readdir(path.join(MOCK_ROOT(), dir));
    return Promise.all(
      names.map(async (name) => {
        const buf = await fs.readFile(path.join(MOCK_ROOT(), dir, name));
        return { name, path: `${dir}/${name}`, sha: blobSha(buf), type: 'file' };
      }),
    );
  } catch {
    return [];
  }
}

async function mockReadBlob(sha) {
  try {
    return await fs.readFile(path.join(mockBlobs(), sha));
  } catch {
    return null;
  }
}

async function mockCommit(changes) {
  for (const c of changes) {
    const full = path.join(MOCK_ROOT(), c.path);
    if (c.delete) {
      await fs.rm(full, { force: true });
      continue;
    }
    await fs.mkdir(path.dirname(full), { recursive: true });
    const data = c.sha ? await mockReadBlob(c.sha) : Buffer.from(c.content);
    await fs.writeFile(full, data);
    await fs.mkdir(mockBlobs(), { recursive: true });
    await fs.writeFile(path.join(mockBlobs(), blobSha(data)), data);
  }
  return 'mock-' + Date.now();
}

async function mockCreateBlob(buf) {
  await fs.mkdir(mockBlobs(), { recursive: true });
  const sha = blobSha(buf);
  await fs.writeFile(path.join(mockBlobs(), sha), buf);
  return sha;
}

/* ---------------- Public API ---------------- */
export async function listDir(dir) {
  return storeMode() === 'mock' ? mockListDir(dir) : ghListDir(dir);
}

export async function readText(entry) {
  if (storeMode() === 'mock') {
    try { return await fs.readFile(path.join(MOCK_ROOT(), entry.path), 'utf8'); } catch { return null; }
  }
  const buf = await ghReadBlob(entry.sha);
  return buf ? buf.toString('utf8') : null;
}

export async function readFile(filePath) {
  if (storeMode() === 'mock') {
    try { return await fs.readFile(path.join(MOCK_ROOT(), filePath)); } catch { return null; }
  }
  const meta = await ghFileMeta(filePath);
  if (!meta || Array.isArray(meta)) return null;
  return ghReadBlob(meta.sha);
}

/** Reads a text file and its sha, for optimistic-concurrency saves. Returns null if missing. */
export async function readTextWithSha(filePath) {
  if (storeMode() === 'mock') {
    try {
      const buf = await fs.readFile(path.join(MOCK_ROOT(), filePath));
      return { text: buf.toString('utf8'), sha: blobSha(buf) };
    } catch { return null; }
  }
  const meta = await ghFileMeta(filePath);
  if (!meta || Array.isArray(meta)) return null;
  const buf = meta.content ? Buffer.from(meta.content, 'base64') : await ghReadBlob(meta.sha);
  return buf ? { text: buf.toString('utf8'), sha: meta.sha } : null;
}

export async function readBlob(sha) {
  return storeMode() === 'mock' ? mockReadBlob(sha) : ghReadBlob(sha);
}

export async function createBlob(buf) {
  return storeMode() === 'mock' ? mockCreateBlob(buf) : ghCreateBlob(buf);
}

export async function commit(changes, message) {
  return storeMode() === 'mock' ? mockCommit(changes, message) : ghCommit(changes, message);
}
