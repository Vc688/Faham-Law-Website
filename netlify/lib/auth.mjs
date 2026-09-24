// Password login with an HMAC-signed, HttpOnly session cookie.
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE = 'fl_session';
const MAX_AGE = 60 * 60 * 12; // 12 hours

const env = (k) => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k] ?? '').trim();

export function adminPassword() {
  return env('ADMIN_PASSWORD');
}

function key() {
  // Changing ADMIN_PASSWORD automatically signs everyone out.
  return env('SESSION_SECRET') || createHash('sha256').update('fl-admin:' + adminPassword()).digest('hex');
}

function sign(value) {
  return createHmac('sha256', key()).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function checkPassword(input) {
  const pw = adminPassword();
  if (!pw || pw.length < 10) return false; // refuse to run with no/weak password
  const h = (s) => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(h(input), h(pw));
}

export function sessionCookie(secure = true) {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const value = `${exp}.${sign(exp)}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`;
}

export function clearCookie(secure = true) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function isAuthed(req) {
  if (!adminPassword()) return false;
  const raw = req.headers.get('cookie') || '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig) return false;
  if (!safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now() / 1000;
}
