// Validation for src/content/site.json, the file behind the admin's "Site" tab.
// Astro renders the site from this file, so a bad save would break the next deploy;
// this keeps the shape sane without dictating every field.
export const SITE_FILE = 'src/content/site.json';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set(['about', 'contact', 'fees', 'services', 'insights', 'admin', 'file-a-trademark', 'thank-you', '404', 'api', 'images', 'uploads', 'testimonials']);
const IMAGE_RE = /^\/(?:images|uploads)\/[a-z0-9][a-z0-9/._-]*\.(?:webp|jpe?g|png|gif)$/i;
const MAX_BYTES = 600_000;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => typeof v === 'string';

export function validateSite(site) {
  if (!isObj(site)) return 'Missing site content.';
  if (JSON.stringify(site).length > MAX_BYTES) return 'Site content is too large.';

  for (const k of ['firm', 'settings', 'home', 'about', 'services', 'fees', 'contact']) {
    if (!isObj(site[k])) return `Missing "${k}" section.`;
  }
  for (const k of ['practices', 'industries', 'testimonials', 'inquiryReasons']) {
    if (!Array.isArray(site[k])) return `"${k}" must be a list.`;
  }

  const f = site.firm;
  for (const k of ['name', 'shortName', 'tagline', 'partner', 'phone', 'email', 'url', 'blurb', 'disclaimer']) {
    if (!str(f[k]) || !f[k].trim()) return `Firm: "${k}" is required.`;
  }
  if (!/^\d{4}$/.test(String(f.since))) return 'Firm: "since" must be a four-digit year.';
  if (f.phone.replace(/\D/g, '').length < 10) return 'Firm: phone number looks incomplete.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return 'Firm: email address is invalid.';
  if (!Array.isArray(f.offices) || !f.offices.length) return 'Firm: add at least one office.';
  for (const o of f.offices) {
    if (!isObj(o) || !str(o.city) || !o.city.trim() || !str(o.state) || !o.state.trim()) return 'Firm: each office needs a city and state.';
  }

  const s = site.settings;
  if (typeof s.showTestimonials !== 'boolean' || typeof s.showInsights !== 'boolean') return 'Settings: toggles must be on or off.';
  if (!str(s.headshot) || !IMAGE_RE.test(s.headshot)) return 'Settings: headshot must be an uploaded image.';
  if (s.headingAccent != null && !['plain', 'color', 'italic'].includes(s.headingAccent)) return 'Settings: headline accent style is invalid.';
  if (!isObj(s.headerCta) || !str(s.headerCta.label) || !s.headerCta.label.trim() || !str(s.headerCta.href)) return 'Settings: header button needs a label and a link.';

  if (!site.practices.length) return 'Add at least one practice area.';
  const seen = new Set();
  for (const p of site.practices) {
    if (!isObj(p)) return 'Practice areas: invalid entry.';
    if (!str(p.slug) || !SLUG_RE.test(p.slug) || p.slug.length > 60) return `Practice areas: web address "${p.slug || ''}" must use lowercase letters, numbers and hyphens.`;
    if (RESERVED.has(p.slug)) return `Practice areas: "${p.slug}" is reserved and can't be used as a web address.`;
    if (seen.has(p.slug)) return `Practice areas: two areas share the web address "${p.slug}".`;
    seen.add(p.slug);
    for (const k of ['name', 'short', 'seoTitle', 'seoDescription', 'h1', 'intro', 'cta']) {
      if (!str(p[k]) || !p[k].trim()) return `Practice area "${p.name || p.slug}": "${k}" is required.`;
    }
    if (!Array.isArray(p.groups) || !Array.isArray(p.faqs)) return `Practice area "${p.name}": sections and questions must be lists.`;
    for (const g of p.groups) {
      if (!isObj(g) || !str(g.title) || !g.title.trim() || !Array.isArray(g.items)) return `Practice area "${p.name}": each section needs a title.`;
      for (const it of g.items) if (!isObj(it) || !str(it.text) || !it.text.trim()) return `Practice area "${p.name}": each item in "${g.title}" needs text.`;
    }
    for (const q of p.faqs) if (!isObj(q) || !str(q.q) || !q.q.trim() || !str(q.a) || !q.a.trim()) return `Practice area "${p.name}": each question needs a question and an answer.`;
    if (p.ctaSecondary != null && (!isObj(p.ctaSecondary) || !str(p.ctaSecondary.label) || !str(p.ctaSecondary.href))) return `Practice area "${p.name}": the second button needs a label and a link.`;
  }

  const home = site.home;
  for (const k of ['seoTitle', 'seoDescription', 'title', 'lead']) if (!str(home[k]) || !home[k].trim()) return `Home: "${k}" is required.`;
  if (!Array.isArray(home.stages) || !home.stages.length) return 'Home: add at least one row to "Where is your business today?".';
  for (const st of home.stages) {
    if (!isObj(st) || !str(st.need) || !seen.has(st.slug)) return `Home: each "Where is your business today?" row needs a label and an existing practice area.`;
  }
  if (!isObj(home.gc) || !Array.isArray(home.gc.points)) return 'Home: the general counsel section is incomplete.';

  const fees = site.fees;
  if (!Array.isArray(fees.sections)) return 'Fees: sections must be a list.';
  for (const sec of fees.sections) {
    if (!isObj(sec) || !str(sec.title) || !Array.isArray(sec.groups)) return 'Fees: each section needs a title.';
    for (const g of sec.groups) {
      if (!isObj(g) || !Array.isArray(g.rows)) return `Fees: "${sec.title}" has an invalid group.`;
      for (const r of g.rows) if (!isObj(r) || !str(r.service) || !r.service.trim() || !str(r.fee)) return `Fees: each row in "${sec.title}" needs a service and a fee.`;
    }
  }

  for (const t of site.testimonials) if (!isObj(t) || !str(t.quote) || !t.quote.trim() || !str(t.name) || !t.name.trim()) return 'Testimonials: each one needs a quote and a name.';
  if (site.industries.some((x) => !str(x)) || site.inquiryReasons.some((x) => !str(x))) return 'Industries and inquiry reasons must be text.';
  if (!site.inquiryReasons.length) return 'Add at least one inquiry reason for the contact form.';
  return null;
}
