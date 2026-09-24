# fahamlaw.com

Custom website for Faham Law LLC. Built with [Astro](https://astro.build), hosted on **Netlify (Free plan)**.

- Public site: static pages, fast, no database.
- `/admin`: password-protected dashboard to write/publish Insights posts and read form inquiries.
- Forms (Contact, File a Trademark) are handled by Netlify Forms (free, unlimited submissions).

---

## One-time setup (about 15 minutes)

### 1. Create the site on Netlify
1. Netlify → **Add new project → Import an existing project → GitHub** → choose `Vc688/Faham-Law-Website`.
2. Build settings are read from `netlify.toml` automatically (build `npm run build`, publish `dist`). Click **Deploy**.

### 2. Turn on forms and email notifications
1. Project → **Forms** → **Enable form detection**, then trigger a redeploy (Deploys → Trigger deploy).
2. Forms → **Form notifications → Add notification → Email notification** → form `contact` → `assistant@fahamlaw.com`.
3. Repeat for form `trademark`.
4. Spam: Netlify filters spam automatically (Akismet); both forms also have a hidden honeypot field.

### 3. Admin environment variables
Project configuration → **Environment variables** → add:

| Key | Value |
|---|---|
| `ADMIN_PASSWORD` | A strong password (at least 10 characters). This is the admin login. |
| `GITHUB_REPO` | `Vc688/Faham-Law-Website` |
| `GITHUB_BRANCH` | `main` |
| `GITHUB_TOKEN` | A GitHub fine-grained token (see below) |
| `NETLIFY_API_TOKEN` | A Netlify personal access token (see below) |

**GitHub token:** GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate. Repository access: *Only select repositories* → `Faham-Law-Website`. Permissions: **Contents: Read and write**. Set an expiration you'll remember (e.g., 1 year) and put a reminder on the calendar.

**Netlify token:** Netlify → avatar → User settings → Applications → **Personal access tokens** → New access token.

Redeploy once after adding variables (Deploys → Trigger deploy).

### 4. Connect the domain (launch day)
1. Netlify → Domain management → **Add a domain** → `www.fahamlaw.com` (primary) and `fahamlaw.com` (redirects to www).
2. At **GoDaddy → DNS**, change **only** these records, using the values Netlify shows:
   - `A @` → Netlify's load balancer IP (replace the four Squarespace A records)
   - `CNAME www` → `<your-site>.netlify.app`
3. **Do not touch** MX, TXT (SPF), autodiscover, SRV, lyncdiscover, sip, enterpriseenrollment/registration. Those run email (Microsoft 365).
4. Wait for Netlify to issue HTTPS certificates. Check `https://fahamlaw.com` and `https://www.fahamlaw.com`, then send a test email to david@fahamlaw.com.
5. Google Search Console: submit `https://www.fahamlaw.com/sitemap-index.xml`.

---

## Using the admin
Go to `https://www.fahamlaw.com/admin` and sign in with `ADMIN_PASSWORD`.

- **Posts → New post.** Write in the editor (pasting from Word/Google Docs keeps headings, bold and lists). Add a category, summary and optional cover image.
  - **Save draft**: private; does **not** rebuild the site (no Netlify credits used).
  - **Publish / Update**: the site rebuilds and the post is live in about 1–2 minutes (~15 Netlify credits).
- **Inquiries**: contact and trademark submissions, search, full details, and **Export CSV**.
- **Dashboard**: counts, latest inquiries, and whether the latest site update succeeded.

Netlify Free includes 300 credits/month; each publish uses 15. If the site ever pauses for credits, upgrading to Personal ($9/mo) restores it.

---

## Editing the site itself
- Firm facts, practice-area copy, FAQs, testimonials: `src/data/site.ts`
- Pages: `src/pages/` · Components: `src/components/` · Styles: `src/styles/global.css`
- Hide testimonials site-wide: set `showTestimonials = false` in `src/data/site.ts`.
- David's headshot: `public/images/david-faham.jpg` (currently 500×750; replace with a larger export of the same photo, ~1000×1500, when available).
- Logo files: `public/images/logo.png` (light backgrounds), `logo-light.png` (dark backgrounds), `logo-tagline.png`, `logo-mark.png`. Favicons in `public/` are cut from the same mark.

Local preview: `npm install`, `npm run build`, then `ADMIN_PASSWORD=anything123 npm run preview` → http://localhost:4321 (admin runs in local test mode and saves to your computer, not GitHub).

## Redirects kept from Squarespace
`/new-page` → `/file-a-trademark`, `/contact-faham` → `/contact`, `/home` → `/` (see `netlify.toml`). All other URLs are unchanged.
