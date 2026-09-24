import { firm, practices, settings, about } from '../data/site';

export const orgId = `${firm.url}/#firm`;
export const davidId = `${firm.url}/about#david-faham`;

const postal = (o: { street: string; city: string; state: string; zip: string }) => ({
  '@type': 'PostalAddress',
  ...(o.street ? { streetAddress: o.street } : {}),
  addressLocality: o.city,
  addressRegion: o.state,
  ...(o.zip ? { postalCode: o.zip } : {}),
  addressCountry: 'US',
});

export const legalService = {
  '@context': 'https://schema.org',
  '@type': 'LegalService',
  '@id': orgId,
  name: firm.name,
  url: firm.url,
  logo: `${firm.url}/images/logo.png`,
  image: `${firm.url}/images/og-default.png`,
  description: firm.blurb,
  telephone: `+1-${firm.phone.replace(/\D/g, '').replace(/^1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}`,
  email: firm.email,
  foundingDate: String(firm.since),
  slogan: firm.tagline,
  priceRange: `${firm.hourlyRate}/hour`,
  areaServed: [
    { '@type': 'State', name: 'New York' },
    { '@type': 'State', name: 'New Jersey' },
    { '@type': 'State', name: 'Pennsylvania' },
  ],
  address: firm.offices.map(postal),
  knowsAbout: practices.map((p) => p.name),
  employee: { '@id': davidId },
  sameAs: [firm.linkedinFirm],
};

export const davidPerson = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': davidId,
  name: firm.partner,
  jobTitle: firm.partnerTitle,
  worksFor: { '@id': orgId },
  url: `${firm.url}/about`,
  image: `${firm.url}${settings.headshot}`,
  alumniOf: about.education.map((e) => ({ '@type': 'CollegeOrUniversity', name: e.school })),
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
