// All site copy lives in src/content/site.json and is edited from /admin (Site tab).
// This module loads it and exposes typed, derived values to pages and components.
import raw from '../content/site.json';

export type Link = { label: string; href: string };
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
  ctaSecondary?: Link | null;
};
export type Office = { label: string; street: string; city: string; state: string; zip: string };
export type FeeRow = { service: string; fee: string; gov: string };
export type FeeGroup = { title: string; rows: FeeRow[] };
export type FeeSection = { title: string; groups: FeeGroup[] };

export const site = raw;

const digits = raw.firm.phone.replace(/\D/g, '');
export const firm = {
  ...raw.firm,
  phoneHref: `tel:+1${digits.length === 11 ? digits.slice(1) : digits}`,
  offices: raw.firm.offices as Office[],
};

/** "294 Maplewood Avenue, Oakhurst, NJ 07755" or "New York, NY" for a city-only office. */
export function officeLine(o: Office): string {
  const cityState = [o.city, o.state].filter(Boolean).join(', ') + (o.zip ? ` ${o.zip}` : '');
  return o.street ? `${o.street}, ${cityState}` : cityState;
}
export const officeLabels = firm.offices.map((o) => o.label);

export const settings = raw.settings;
export const showTestimonials = raw.settings.showTestimonials;
export const home = raw.home;
export const about = raw.about;
export const services = raw.services;
export const fees = raw.fees as typeof raw.fees & { sections: FeeSection[] };
export const contact = raw.contact;
export const industries: string[] = raw.industries;
export const testimonials = raw.testimonials;
export const inquiryReasons: string[] = raw.inquiryReasons;
export const practices = raw.practices as Practice[];
export const practiceBySlug: Record<string, Practice> = Object.fromEntries(practices.map((p) => [p.slug, p]));

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Headings may mark an italic phrase with *asterisks*; returns safe HTML with <em>. */
export function emph(s: string): string {
  return escapeHtml(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
/** Same text with the asterisks stripped (for <title>, alt text, schema). */
export function plain(s: string): string {
  return s.replace(/\*([^*]+)\*/g, '$1');
}
