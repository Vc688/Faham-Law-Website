// Reads form submissions and deploy status from the Netlify API.
const env = (k) => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k] ?? '').trim();

export function netlifyConfigured() {
  return env('ADMIN_MOCK') === '1' || Boolean(env('NETLIFY_API_TOKEN'));
}

async function api(url) {
  const res = await fetch(`https://api.netlify.com/api/v1${url}`, {
    headers: { authorization: `Bearer ${env('NETLIFY_API_TOKEN')}`, 'user-agent': 'fahamlaw-admin' },
  });
  if (!res.ok) throw new Error(`Netlify API ${url} failed: ${res.status}`);
  return res.json();
}

function siteId(context) {
  return env('NETLIFY_SITE_ID') || context?.site?.id || env('SITE_ID');
}

const FIELD_ORDER = {
  contact: ['first_name', 'last_name', 'email', 'phone', 'reason', 'message'],
  trademark: [
    'owner_name', 'entity_type', 'email', 'phone', 'country', 'address_line1', 'address_line2',
    'city', 'state', 'zip', 'mark_words', 'logo', 'goods_services', 'first_use',
  ],
};
export { FIELD_ORDER };

function clean(data = {}) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (['form-name', 'bot-field', 'ip', 'user_agent', 'referrer'].includes(k)) continue;
    if (v && typeof v === 'object' && v.url) out[k] = { url: v.url, filename: v.filename || 'file' };
    else out[k] = v == null ? '' : String(v);
  }
  return out;
}

export async function getSubmissions(formName, context) {
  if (env('ADMIN_MOCK') === '1') return mockSubmissions(formName);
  const forms = await api(`/sites/${siteId(context)}/forms`);
  const form = forms.find((f) => f.name === formName);
  if (!form) return [];
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await api(`/forms/${form.id}/submissions?per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.map((s) => ({ id: s.id, number: s.number, created_at: s.created_at, data: clean(s.data) }));
}

export async function getDeploys(context) {
  if (env('ADMIN_MOCK') === '1') {
    return [{ id: 'm1', state: 'ready', created_at: new Date().toISOString(), title: 'Mock deploy', error_message: null }];
  }
  const list = await api(`/sites/${siteId(context)}/deploys?per_page=6`);
  return list.map((d) => ({
    id: d.id,
    state: d.state,
    created_at: d.created_at,
    published_at: d.published_at,
    title: d.title,
    context: d.context,
    error_message: d.error_message,
  }));
}

function mockSubmissions(formName) {
  const now = Date.now();
  const day = 86400000;
  if (formName === 'trademark') {
    return [
      { id: 't1', number: 2, created_at: new Date(now - 2 * day).toISOString(), data: { owner_name: 'Sample Apparel LLC', entity_type: 'LLC', email: 'owner@example.com', phone: '(555) 010-2000', country: 'United States', address_line1: '1 Example St', address_line2: '', city: 'Brooklyn', state: 'NY', zip: '11201', mark_words: 'NORTHLINE and logo', logo: { url: '#', filename: 'logo.png' }, goods_services: 'Clothing, namely shirts and hats', first_use: '03/01/2026' } },
      { id: 't2', number: 1, created_at: new Date(now - 9 * day).toISOString(), data: { owner_name: 'Jane Example', entity_type: 'Individual', email: 'jane@example.com', phone: '(555) 010-3000', country: 'United States', address_line1: '22 Sample Ave', address_line2: 'Apt 4', city: 'Oakhurst', state: 'NJ', zip: '07755', mark_words: 'BRIGHTLEAF', goods_services: 'Candles', first_use: 'N/A' } },
    ];
  }
  return [
    { id: 'c1', number: 3, created_at: new Date(now - 1 * day).toISOString(), data: { first_name: 'Sam', last_name: 'Example', email: 'sam@example.com', phone: '(555) 010-1000', reason: 'Real Estate', message: 'We are signing a lease for a new retail location and would like the lease reviewed.' } },
    { id: 'c2', number: 2, created_at: new Date(now - 4 * day).toISOString(), data: { first_name: 'Alex', last_name: 'Sample', email: 'alex@example.com', phone: '', reason: 'Startups & Small Business', message: 'Starting a food company with a partner and need an LLC and operating agreement.' } },
    { id: 'c3', number: 1, created_at: new Date(now - 40 * day).toISOString(), data: { first_name: 'Pat', last_name: 'Demo', email: 'pat@example.com', phone: '(555) 010-4000', reason: 'Mergers & Acquisitions', message: 'Considering selling my distribution business.' } },
  ];
}
