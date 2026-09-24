import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'insights'>;

export async function getPublishedPosts(): Promise<Post[]> {
  const all = await getCollection('insights', ({ data }) => !data.draft);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function readingTime(body = ''): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
