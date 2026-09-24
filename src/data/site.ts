// Single source of truth for firm facts and page copy.
// Copy comes from the approved Claude Doc draft and the live site. Do not add claims
// here that David has not approved (see compliance notes in README.md).

export const firm = {
  name: 'Faham Law LLC',
  shortName: 'Faham Law',
  tagline: 'Experience. Diligence. Results.',
  partner: 'David Faham',
  since: 2011,
  phone: '(212) 961-7503',
  phoneHref: 'tel:+12129617503',
  email: 'david@fahamlaw.com',
  offices: ['New York, NY', 'Oakhurst, NJ'],
  licensed: 'Licensed in New York, New Jersey & Pennsylvania',
  linkedinFirm: 'https://www.linkedin.com/company/fahamlaw/',
  linkedinDavid: 'https://www.linkedin.com/in/dcfaham/',
  url: 'https://www.fahamlaw.com',
  blurb:
    'Faham Law LLC is a boutique business law firm advising companies in New York, New Jersey and Pennsylvania on corporate, M&A, real estate and intellectual property matters.',
  disclaimer:
    'The information on this website is for general informational purposes only and is not legal advice. Contacting Faham Law LLC does not create an attorney-client relationship.',
  fees:
    "We know our clients have different needs, so depending on the matter, we offer various payment and fee structures. We only work for as long as a matter requires, so you'll never be over billed for unproductive time.",
};

// Set to false to hide testimonials site-wide (the /testimonials URL then redirects to /about).
// Before launch: confirm written consent from each client (NY Rule 7.1).
export const showTestimonials = true;

export const industries = [
  'Consumer products & wholesale',
  'Licensing companies',
  'Technology & startups',
  'Restaurants',
  'Apparel & fashion',
  'Amazon & e-commerce',
  'Real estate',
];

export type Faq = { q: string; a: string };
export type Group = { title: string; items: { label?: string; text: string }[]; note?: string };
export type Practice = {
  slug: string;
  name: string;
  short: string;
  seoTitle: string;
  seoDescription: string;
  h1: string;
  intro: string;
  groups: Group[];
  who?: string;
  faqs: Faq[];
  cta: string;
  ctaSecondary?: { label: string; href: string };
};

export const practices: Practice[] = [
  {
    slug: 'startups-small-business',
    name: 'Startups & Small Business',
    short:
      'Starting a business? We form your LLC or corporation and draft the documents it runs on: operating and shareholder agreements, website terms and privacy policies, and SaaS and end-user license agreements.',
    seoTitle: 'Business Formation & Startup Lawyer in NY & NJ',
    seoDescription:
      'LLC and corporation formation, operating and shareholder agreements, website terms, privacy policies, and SaaS and end-user agreements for startups and small businesses.',
    h1: 'Legal Foundations for Startups & Small Businesses',
    intro:
      "The decisions you make when you start a business, like how it's structured, who owns what, and what your customers agree to, are much cheaper to get right at the start than to fix later. We help founders set up their companies properly and put the core documents in place.",
    groups: [
      {
        title: 'What we handle',
        items: [
          { label: 'Entity formation', text: 'Choosing between an LLC, corporation, partnership or nonprofit; preparing and filing formation documents; obtaining an EIN; and advising on ownership and governance.' },
          { label: 'Founder and ownership documents', text: "Operating agreements and shareholders' agreements." },
          { label: 'Website and app documents', text: 'Terms of Use, Privacy Policies and other user agreements.' },
          { label: 'Software agreements', text: 'SaaS agreements and end-user license agreements (EULAs).' },
          { label: 'Everyday contracts', text: 'Vendor, supplier, independent contractor and confidentiality agreements.' },
          { label: 'Nonprofits', text: "Forming and dissolving New York not-for-profit corporations, including work with the Attorney General's Office." },
        ],
      },
    ],
    who: 'First-time founders, technology startups, restaurants, apparel and consumer brands, Amazon and e-commerce sellers, and small businesses formalizing an existing operation.',
    faqs: [
      { q: 'Should I form an LLC or a corporation?', a: 'It depends on how you plan to raise money, pay yourself and handle taxes. Many small businesses start as LLCs, and companies planning to raise venture capital often form corporations.' },
      { q: 'Do I need an operating agreement?', a: "New York requires LLCs to adopt a written operating agreement. Even where it isn't required, it sets out who owns what and what happens if a member leaves." },
      { q: "What is New York's LLC publication requirement?", a: 'New York LLCs must publish notice of formation in two newspapers within 120 days of forming, or lose the authority to do business in the state until they comply.' },
    ],
    cta: 'Starting something new? Book a consultation to set it up right.',
  },
  {
    slug: 'corporate-counsel',
    name: 'Corporate Counsel',
    short:
      'Outside general counsel for mid-sized companies that need regular legal support without an in-house legal department. We draft, review and negotiate your agreements.',
    seoTitle: 'Outside General Counsel for Businesses in NY & NJ',
    seoDescription:
      'Outside general counsel for mid-sized companies: drafting, reviewing and negotiating commercial agreements, employment matters and day-to-day legal advice.',
    h1: 'Outside General Counsel for Growing Companies',
    intro:
      'Many companies have regular legal needs but no in-house legal department. We fill that role on demand. With general counsel experience at companies large and small, David learns how your business works and gives practical advice that fits it. For matters outside our practice, we bring in trusted firms from our network and manage the work for you.',
    groups: [
      {
        title: 'What we handle',
        items: [
          { label: 'Commercial agreements', text: 'Master services, professional services and consulting agreements; reseller, distribution and marketing agreements; supply and factory agreements; and technology agreements.' },
          { label: 'Contract review and negotiation', text: "Reviewing the other side's paper, flagging risk and negotiating better terms." },
          { label: 'Confidentiality', text: 'Non-disclosure and confidentiality agreements.' },
          { label: 'Employment', text: 'Offer letters, employee handbooks, wage and hour compliance, workplace investigations and terminations.' },
          { label: 'Compliance and disputes', text: 'Corporate compliance, and resolving disputes before they become lawsuits.' },
        ],
      },
    ],
    who: 'Small and mid-sized, privately held companies, including consumer products and wholesale companies, licensing companies, technology companies, restaurants, apparel brands, and Amazon and e-commerce businesses.',
    faqs: [
      { q: 'What does outside general counsel do?', a: 'The same work as an in-house lawyer, on an as-needed basis: contracts, employment questions, compliance and advice on business decisions.' },
      { q: 'How is it billed?', a: 'We offer different fee structures depending on your needs. Contact us for rates.' },
    ],
    cta: 'Need a lawyer who knows your business? Book a consultation.',
  },
  {
    slug: 'mergers-acquisitions',
    name: 'Mergers & Acquisitions',
    short:
      'We represent buyers and sellers of businesses, from letter of intent and due diligence through the purchase agreement and closing.',
    seoTitle: 'M&A Lawyer for Buying & Selling a Business | NY & NJ',
    seoDescription:
      'Representation for buyers and sellers of privately held businesses: letters of intent, due diligence, purchase agreements and closing.',
    h1: 'Buying or Selling a Business',
    intro:
      "Selling your company or buying another one is often the biggest transaction of an owner's career. We represent buyers and sellers of privately held businesses and guide them from first offer to closing. Across our practice, we advise clients in deals ranging from a few hundred thousand to a few million dollars.",
    groups: [
      {
        title: 'What we handle',
        items: [
          { label: 'Deal structure', text: 'Asset purchases, stock or membership interest purchases, mergers and joint ventures.' },
          { label: 'Letters of intent', text: 'Negotiating price, structure and key terms before the deal is papered.' },
          { label: 'Due diligence', text: "Organizing a seller's records, or reviewing a target's contracts, liabilities and IP for a buyer." },
          { label: 'Purchase agreements', text: 'Drafting and negotiating the purchase agreement and closing documents.' },
          { label: 'Closing and after', text: 'Employment, consulting and transition agreements for owners and key staff.' },
        ],
      },
    ],
    who: 'Owners selling their businesses, companies buying competitors or suppliers, and partners buying each other out, across consumer products, wholesale, technology, restaurants, apparel and e-commerce.',
    faqs: [
      { q: "What's the difference between an asset sale and a stock sale?", a: 'In an asset sale the buyer picks which assets and liabilities it takes. In a stock sale the buyer takes the whole company, including its liabilities. Each choice has different tax and risk consequences.' },
      { q: 'Is a letter of intent binding?', a: 'Usually only in part. Price and deal terms are often non-binding, while confidentiality and exclusivity provisions typically are binding.' },
    ],
    cta: 'Thinking about buying or selling? Talk to us early, before the letter of intent is signed.',
  },
  {
    slug: 'real-estate',
    name: 'Real Estate',
    short:
      'Residential and commercial closings, purchases and sales, and lease and sublease reviews in New York, New Jersey and Pennsylvania.',
    seoTitle: 'NJ & NY Real Estate Attorney: Closings & Leases',
    seoDescription:
      'Residential and commercial real estate closings, purchase and sale contracts, and lease and sublease reviews in New Jersey, New York and Pennsylvania.',
    h1: 'Real Estate Attorney for Residential & Commercial Transactions',
    intro:
      "Whether you're buying a home, selling a building or signing a lease for your business, we review the documents, negotiate the terms and see the deal through to closing. We represent buyers, sellers, landlords and tenants in New Jersey, New York and Pennsylvania.",
    groups: [
      {
        title: 'What we handle',
        items: [
          { label: 'Residential', text: 'Purchase and sale contracts, attorney review and closings for buyers and sellers.' },
          { label: 'Commercial', text: 'Acquisitions and sales of single properties and portfolios, financing documents, and joint ventures.' },
          { label: 'Leases and subleases', text: 'Drafting, reviewing and negotiating leases for retail stores, office space, warehouses and residences, for landlords and tenants.' },
        ],
      },
    ],
    who: 'Homebuyers and sellers, business owners leasing or buying space, property owners and investors, and companies whose other legal work we already handle.',
    faqs: [
      { q: 'What is attorney review in New Jersey?', a: "In New Jersey, a residential contract prepared by a real estate agent has a three-business-day attorney review period, during which either side's attorney can approve, change or cancel it." },
      { q: 'Should a lawyer review my commercial lease?', a: 'Yes. Commercial leases are usually drafted for the landlord, and terms like rent increases, repairs, personal guarantees and early exit are negotiable before you sign.' },
      { q: 'Can I sublease my space?', a: "It depends on your lease. Most commercial leases require the landlord's written consent, and some prohibit subleasing outright." },
    ],
    cta: 'Buying, selling or leasing? Book a consultation before you sign.',
  },
  {
    slug: 'ip-trademarks',
    name: 'IP & Trademarks',
    short:
      'Trademark searches, filings, registration, maintenance and renewals, plus licensing and Amazon Brand Registry matters.',
    seoTitle: 'Trademark & Amazon Brand Registry Attorney',
    seoDescription:
      'Trademark searches, USPTO filings, registration, maintenance and renewals, copyright, IP licensing, and Amazon Brand Registry and infringement matters for businesses.',
    h1: 'Trademark & Intellectual Property Counsel',
    intro:
      'Your brand name, logo and creative work are often your most valuable assets. We protect them from the first clearance search through registration and every renewal after. When someone infringes, or you need to license your IP, we handle that too.',
    groups: [
      {
        title: 'Trademarks',
        items: [
          { label: 'Clearance', text: 'Searches and opinions on whether a proposed name or logo is available.' },
          { label: 'Filing and prosecution', text: 'Preparing U.S. and international applications and responding to USPTO office actions through registration.' },
          { label: 'Maintenance and renewals', text: 'Tracking deadlines and filing maintenance declarations and renewals so registrations stay alive.' },
          { label: 'Enforcement', text: 'Monitoring and enforcement strategy, and recording registrations with U.S. Customs to block counterfeit imports.' },
          { label: 'Portfolio management', text: 'Managing domestic and international portfolios and advising on branding strategy.' },
        ],
      },
      {
        title: 'Amazon Brand Registry & E-commerce',
        note: 'We help Amazon and e-commerce sellers protect their brands on the platform.',
        items: [
          { text: 'Brand Registry enrollment, including appeals when a request is denied.' },
          { text: 'Reporting infringing and counterfeit listings, ASIN hijackers and inauthentic products.' },
          { text: "Responding to Amazon infringement complaints, fraud accusations and account suspensions through Amazon's own processes." },
        ],
      },
      {
        title: 'Copyright, Licensing & Fashion',
        items: [
          { label: 'Copyright', text: 'Registration searches, applications and maintenance.' },
          { label: 'Licensing', text: 'For licensors and licensees, including royalty or flat-fee structures, exclusivity, territory, term, indemnification and sub-licensing.' },
          { label: 'Fashion and apparel', text: 'Protecting designs and brands through trademark, copyright and licensing.' },
        ],
      },
    ],
    faqs: [
      { q: 'How long does trademark registration take?', a: 'The USPTO reports an average of about 10 months from filing, depending on its backlog and whether the examiner raises issues.' },
      { q: 'When do I need to renew?', a: 'A maintenance declaration is due between the 5th and 6th year after registration, then a combined declaration and renewal every 10 years.' },
      { q: 'Can I join Amazon Brand Registry before my trademark registers?', a: "Yes. Amazon accepts either an active registered trademark or a pending application, as long as it's a word mark or a design mark with words, letters or numbers, from a government trademark office. The trademark owner must be the one who applies. Amazon's IP Accelerator program is optional." },
    ],
    cta: 'Protect your brand before someone else claims it. Book a consultation or file a trademark.',
    ctaSecondary: { label: 'File a trademark', href: '/file-a-trademark' },
  },
];

export const practiceBySlug = Object.fromEntries(practices.map((p) => [p.slug, p]));

export const testimonials = [
  {
    quote:
      "Over the years we've had the opportunity to work with David on a series of critically important issues for our businesses. We've found him to be very bright, responsive and adept at addressing issues from the securing of copyrights to crafting and negotiating partnership agreements. We highly recommend David to small and midsized businesses.",
    name: 'Ricky Cohen',
    role: 'Chairman/CEO, Conway Companies',
  },
  {
    quote:
      'David is a pleasure to work with. He is bright, highly motivated, and reliable. He possesses the unique ability to process complex ideas quickly and execute instructions well.',
    name: 'Josh Rosman',
    role: 'Managing Director, Metro Global',
  },
  {
    quote: 'David is an integral part of keeping our company running.',
    name: 'Jas Virdee',
    role: 'Wiesner Products Inc.',
  },
  {
    quote: "David's understanding of the legal ins and outs of start-ups was really helpful to our company.",
    name: 'Stephanie Farrell',
    role: 'Kumi Creative LLC',
  },
];

export const inquiryReasons = [
  'Startups & Small Business',
  'Corporate Counsel',
  'Mergers & Acquisitions',
  'Real Estate',
  'IP & Trademarks',
  'Amazon',
  'Other',
];
