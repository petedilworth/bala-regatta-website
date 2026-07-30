import { getCollection, type CollectionEntry } from 'astro:content';

export type Settings = CollectionEntry<'settings'>['data'];

const fallback: Settings = { id: 'site', featured: [] };

let cached: Settings | undefined;

/**
 * The handful of values that change every year — regatta date, registration
 * link, contact details, the curated strip on /archives — live in one YAML file
 * so updating them never means touching a template.
 */
export async function getSettings(): Promise<Settings> {
  if (cached) return cached;
  const entries = await getCollection('settings');
  cached = entries[0]?.data ?? fallback;
  return cached;
}
