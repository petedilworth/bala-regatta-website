import { getCollection, type CollectionEntry } from 'astro:content';
import { editionFor, nextRegattaDate } from './regatta-date';

type Stored = CollectionEntry<'settings'>['data'];

/**
 * What pages read. The date and edition are not stored — they are derived from
 * the long-weekend rule in regatta-date.ts and the edition anchor, at build time —
 * but they are exposed under the same names the templates always used.
 */
export type Settings = Stored & {
  nextRegattaDate: Date;
  nextRegattaEdition: number;
};

const fallback: Stored = { id: 'site', featured: [], editionAnchor: { year: 2026, edition: 115 } };

let cached: Settings | undefined;

/**
 * The handful of values that change every year — registration link, contact
 * details, the curated strip on /archives — live in one YAML file so updating
 * them never means touching a template. The regatta date is the one thing that
 * is never typed; see src/lib/regatta-date.ts.
 */
export async function getSettings(): Promise<Settings> {
  if (cached) return cached;
  const entries = await getCollection('settings');
  const stored = entries[0]?.data ?? fallback;
  const date = nextRegattaDate();
  cached = {
    ...stored,
    nextRegattaDate: date,
    nextRegattaEdition: editionFor(date.getUTCFullYear(), stored.editionAnchor),
  };
  return cached;
}
