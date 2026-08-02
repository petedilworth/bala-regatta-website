/**
 * The kinds of thing the search index holds.
 *
 * This lives in its own module with no imports because it is needed in two
 * places that cannot share code: the build-time index in archive.ts, which
 * pulls in astro:content, and the browser script on /archives, which must not.
 * Keeping one list here is what stops a new record type from being added in
 * three places and forgotten in a fourth.
 */
export const RECORD_TYPES = [
  { value: 'result', plural: 'Results', singular: 'Result' },
  { value: 'official', plural: 'Organisers', singular: 'Organiser' },
  { value: 'trophy', plural: 'Trophies', singular: 'Trophy' },
  { value: 'document', plural: 'Programmes', singular: 'Programme' },
  { value: 'article', plural: 'Press', singular: 'Press' },
  { value: 'photo', plural: 'Photos', singular: 'Photo' },
] as const;

export type RecordType = (typeof RECORD_TYPES)[number]['value'];

/** Singular badge label shown on each search row. */
export const singularLabel: Record<RecordType, string> = Object.fromEntries(
  RECORD_TYPES.map((t) => [t.value, t.singular]),
) as Record<RecordType, string>;

/**
 * Document kinds are stored as slugs. These are what a reader should see —
 * "program" and "results-sheet" are how the data spells them, not how a page
 * should say them.
 */
const DOCUMENT_LABELS: Record<string, string> = {
  program: 'Programme',
  'results-sheet': 'Results sheet',
  poster: 'Poster',
  minutes: 'Minutes',
  other: 'Document',
};

export function documentLabel(kind: string): string {
  return DOCUMENT_LABELS[kind] ?? kind.replace(/-/g, ' ');
}
