import { firm, practices } from '../data/site';

export const orgId = `${firm.url}/#firm`;
export const davidId = `${firm.url}/about#david-faham`;

export const legalService = {
  '@context': 'https://schema.org',
  '@type': 'LegalService',
  '@id': orgId,
  name: firm.name,
  url: firm.url,
  logo: `${firm.url}/images/logo.png`,
  image: `${firm.url}/images/og-default.png`,
  description: firm.blurb,
  telephone: '+1-212-961-7503',
  email: firm.email,
  foundingDate: String(firm.since),
  slogan: firm.tagline,
  areaServed: [
    { '@type': 'State', name: 'New York' },
    { '@type': 'State', name: 'New Jersey' },
    { '@type': 'State', name: 'Pennsylvania' },
  ],
  address: [
    { '@type': 'PostalAddress', addressLocality: 'New York', addressRegion: 'NY', addressCountry: 'US' },
    { '@type': 'PostalAddress', addressLocality: 'Oakhurst', addressRegion: 'NJ', addressCountry: 'US' },
  ],
  knowsAbout: practices.map((p) => p.name),
  employee: { '@id': davidId },
  sameAs: [firm.linkedinFirm],
};

export const davidPerson = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': davidId,
  name: 'David Faham',
  jobTitle: 'Partner',
  worksFor: { '@id': orgId },
  url: `${firm.url}/about`,
  image: `${firm.url}/images/david-faham.jpg`,
  alumniOf: [
    { '@type': 'CollegeOrUniversity', name: 'Fordham University School of Law' },
    { '@type': 'CollegeOrUniversity', name: 'Brooklyn College, City University of New York' },
  ],
  sameAs: [firm.linkedinDavid],
};

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${firm.url}${it.path === '/' ? '' : it.path}`,
    })),
  };
}

export function faqPage(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}
