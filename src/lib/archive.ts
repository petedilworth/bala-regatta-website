import { getCollection, type CollectionEntry } from 'astro:content';
import { href, personHref, yearHref } from './url';

/**
 * Turns the content collections into the shapes the pages actually render.
 *
 * Everything is loaded once and cached for the build. Reference fields arrive as
 * { collection, id } and are resolved through lookup maps here rather than with
 * per-row getEntry() calls, because a century of results is tens of thousands of
 * lookups.
 */

export type Competitor = {
  name: string;
  personId?: string;
  href?: string;
};

export type ResultRow = {
  year: number;
  eventId: string;
  eventName: string;
  /** What the source called it, when that differs from the canonical name. */
  printedName?: string;
  category: string;
  place?: number;
  competitors: Competitor[];
  affiliation?: string;
  time?: string;
  note?: string;
  source?: string;
};

export type Official = {
  year: number;
  role: string;
  name: string;
  personId?: string;
  href?: string;
};

export type PhotoItem = {
  year?: number;
  file: string;
  caption?: string;
  credit?: string;
  personIds: string[];
  eventId?: string;
};

type EventEntry = CollectionEntry<'events'>;
type PersonEntry = CollectionEntry<'people'>;
type YearEntry = CollectionEntry<'years'>;
type ArticleEntry = CollectionEntry<'articles'>;
type DocumentEntry = CollectionEntry<'documents'>;

export type Archive = {
  years: YearEntry[];
  yearsByNumber: Map<number, YearEntry>;
  events: EventEntry[];
  eventsById: Map<string, EventEntry>;
  people: PersonEntry[];
  peopleById: Map<string, PersonEntry>;
  articles: ArticleEntry[];
  documents: DocumentEntry[];
  photos: PhotoItem[];
  rows: ResultRow[];
  officials: Official[];
  rowsByYear: Map<number, ResultRow[]>;
  rowsByEvent: Map<string, ResultRow[]>;
  rowsByPerson: Map<string, ResultRow[]>;
  officialsByYear: Map<number, Official[]>;
  officialsByPerson: Map<string, Official[]>;
  articlesByYear: Map<number, ArticleEntry[]>;
  articlesByPerson: Map<string, ArticleEntry[]>;
  documentsByYear: Map<number, DocumentEntry[]>;
  photosByYear: Map<number, PhotoItem[]>;
  photosByPerson: Map<string, PhotoItem[]>;
};

let cached: Archive | undefined;

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

export async function getArchive(): Promise<Archive> {
  if (cached) return cached;

  const isPublished = (entry: { data: { draft?: boolean } }) =>
    import.meta.env.DEV || entry.data.draft !== true;

  const [years, events, results, people, roles, articles, documents, photoSets] =
    await Promise.all([
      getCollection('years', isPublished),
      getCollection('events'),
      getCollection('results'),
      getCollection('people'),
      getCollection('roles'),
      getCollection('articles', isPublished),
      getCollection('documents'),
      getCollection('photos'),
    ]);

  const eventsById = new Map(events.map((e) => [e.id, e]));
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const yearsByNumber = new Map(years.map((y) => [y.data.year, y]));

  const rows: ResultRow[] = [];
  const rowsByYear = new Map<number, ResultRow[]>();
  const rowsByEvent = new Map<string, ResultRow[]>();
  const rowsByPerson = new Map<string, ResultRow[]>();

  for (const sheet of results) {
    for (const race of sheet.data.races) {
      const event = eventsById.get(race.event.id);
      // reference() already failed the build if this were a bad id; the guard is
      // only here to keep the types honest.
      if (!event) continue;

      for (const placing of race.placings) {
        const competitors: Competitor[] = placing.competitors.map((c) => {
          const person = c.person ? peopleById.get(c.person.id) : undefined;
          const linkable = person && person.data.hidden !== true;
          return {
            name: c.name,
            personId: linkable ? person.id : undefined,
            href: linkable ? personHref(person.id) : undefined,
          };
        });

        const row: ResultRow = {
          year: sheet.data.year,
          eventId: event.id,
          eventName: event.data.name,
          printedName:
            race.titleAsPrinted && race.titleAsPrinted !== event.data.name
              ? race.titleAsPrinted
              : undefined,
          category: event.data.category,
          place: placing.place,
          competitors,
          affiliation: placing.affiliation,
          time: placing.time,
          note: placing.note,
          source: sheet.data.source,
        };

        rows.push(row);
        push(rowsByYear, row.year, row);
        push(rowsByEvent, row.eventId, row);
        for (const c of competitors) {
          if (c.personId) push(rowsByPerson, c.personId, row);
        }
      }
    }
  }

  const officials: Official[] = [];
  const officialsByYear = new Map<number, Official[]>();
  const officialsByPerson = new Map<string, Official[]>();

  for (const sheet of roles) {
    for (const entry of sheet.data.officials) {
      const person = entry.person ? peopleById.get(entry.person.id) : undefined;
      const linkable = person && person.data.hidden !== true;
      const official: Official = {
        year: sheet.data.year,
        role: entry.role,
        name: entry.name,
        personId: linkable ? person.id : undefined,
        href: linkable ? personHref(person.id) : undefined,
      };
      officials.push(official);
      push(officialsByYear, official.year, official);
      if (official.personId) push(officialsByPerson, official.personId, official);
    }
  }

  const articlesByYear = new Map<number, ArticleEntry[]>();
  const articlesByPerson = new Map<string, ArticleEntry[]>();
  for (const article of articles) {
    for (const year of article.data.years) push(articlesByYear, year, article);
    for (const ref of article.data.people) push(articlesByPerson, ref.id, article);
  }

  const documentsByYear = new Map<number, DocumentEntry[]>();
  for (const doc of documents) {
    if (doc.data.year !== undefined) push(documentsByYear, doc.data.year, doc);
  }

  const photos: PhotoItem[] = [];
  const photosByYear = new Map<number, PhotoItem[]>();
  const photosByPerson = new Map<string, PhotoItem[]>();
  for (const set of photoSets) {
    for (const item of set.data.items) {
      const photo: PhotoItem = {
        year: set.data.year,
        file: item.file,
        caption: item.caption,
        credit: item.credit,
        personIds: item.people.map((p) => p.id),
        eventId: item.event?.id,
      };
      photos.push(photo);
      if (photo.year !== undefined) push(photosByYear, photo.year, photo);
      for (const id of photo.personIds) push(photosByPerson, id, photo);
    }
  }

  const byYearDesc = (a: { data: { year: number } }, b: { data: { year: number } }) =>
    b.data.year - a.data.year;

  cached = {
    years: [...years].sort(byYearDesc),
    yearsByNumber,
    events: [...events].sort((a, b) => a.data.name.localeCompare(b.data.name)),
    eventsById,
    people: [...people].sort((a, b) => surname(a.data.name).localeCompare(surname(b.data.name))),
    peopleById,
    articles: [...articles].sort(
      (a, b) => (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0),
    ),
    documents,
    photos,
    rows,
    officials,
    rowsByYear,
    rowsByEvent,
    rowsByPerson,
    officialsByYear,
    officialsByPerson,
    articlesByYear,
    articlesByPerson,
    documentsByYear,
    photosByYear,
    photosByPerson,
  };

  return cached;
}

/** "Mrs. J. Smith" -> "smith", so person lists sort the way a reader expects. */
export function surname(name: string): string {
  const parts = name.trim().replace(/,.*$/, '').split(/\s+/);
  return (parts[parts.length - 1] ?? name).toLowerCase();
}

export function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function placeLabel(place?: number): string {
  if (place === undefined) return 'Winner';
  return ordinal(place);
}

/**
 * One row of the client-side index. Keys are short because this file ships to
 * every visitor who opens /archives — at ~10k records the difference between
 * these and descriptive keys is a few hundred kilobytes.
 *
 *   t type  y year  d decade  l label  s sub-label  h href  k search haystack
 *   e eventId  c category  x sample flag
 */
export type IndexRecord = {
  t: 'result' | 'document' | 'article' | 'photo' | 'official';
  y?: number;
  d?: string;
  l: string;
  s?: string;
  h: string;
  k: string;
  e?: string;
  c?: string;
  /** 1 when the row comes from placeholder seed data. */
  x?: 1;
};

export async function buildSearchIndex(): Promise<IndexRecord[]> {
  const archive = await getArchive();
  const index: IndexRecord[] = [];

  /** Sample rows stay visible but are labelled, so nobody reads them as record. */
  const sample = (year?: number): 1 | undefined =>
    year !== undefined && archive.yearsByNumber.get(year)?.data.sample ? 1 : undefined;

  const aliasText = (id: string) => {
    const event = archive.eventsById.get(id);
    return event ? [event.data.name, ...event.data.aliases].join(' ') : '';
  };

  // Person aliases join the haystack of every row they appear in, so a search
  // for a maiden name finds races recorded under a married name.
  const personAliasText = (ids: (string | undefined)[]) =>
    ids
      .filter((id): id is string => !!id)
      .map((id) => {
        const person = archive.peopleById.get(id);
        return person ? [person.data.name, ...person.data.aliases].join(' ') : '';
      })
      .join(' ');

  for (const row of archive.rows) {
    const names = row.competitors.map((c) => c.name).join(', ');
    index.push({
      t: 'result',
      y: row.year,
      d: decadeOf(row.year),
      l: names,
      s: `${placeLabel(row.place)} — ${row.printedName ?? row.eventName}, ${row.year}`,
      h: yearHref(row.year),
      e: row.eventId,
      c: row.category,
      x: sample(row.year),
      k: [
        names,
        personAliasText(row.competitors.map((c) => c.personId)),
        aliasText(row.eventId),
        row.printedName ?? '',
        row.affiliation ?? '',
        String(row.year),
        decadeOf(row.year),
      ]
        .join(' ')
        .toLowerCase(),
    });
  }

  for (const official of archive.officials) {
    index.push({
      t: 'official',
      y: official.year,
      d: decadeOf(official.year),
      l: official.name,
      s: `${official.role}, ${official.year}`,
      h: yearHref(official.year),
      c: 'Organizing',
      x: sample(official.year),
      k: [
        official.name,
        personAliasText([official.personId]),
        official.role,
        String(official.year),
        decadeOf(official.year),
      ]
        .join(' ')
        .toLowerCase(),
    });
  }

  for (const doc of archive.documents) {
    index.push({
      t: 'document',
      y: doc.data.year,
      d: doc.data.year !== undefined ? decadeOf(doc.data.year) : undefined,
      l: doc.data.title,
      s: doc.data.kind.replace('-', ' '),
      h: href(doc.data.file),
      x: sample(doc.data.year),
      k: [doc.data.title, doc.data.kind, doc.data.description ?? '', String(doc.data.year ?? '')]
        .join(' ')
        .toLowerCase(),
    });
  }

  for (const article of archive.articles) {
    const year = article.data.years[0];
    index.push({
      t: 'article',
      y: year,
      d: year !== undefined ? decadeOf(year) : undefined,
      l: article.data.title,
      s: [article.data.publication, article.data.date?.getFullYear()].filter(Boolean).join(', '),
      h:
        article.data.kind === 'link' && article.data.url
          ? article.data.url
          : href(`/archives/press/${article.id}`),
      x: sample(year),
      k: [
        article.data.title,
        article.data.publication ?? '',
        article.data.summary ?? '',
        // Transcripts carry their whole body into the haystack, which is the
        // reason retyping an article is worth the effort.
        article.data.kind === 'transcript' ? (article.body ?? '') : '',
        article.data.years.join(' '),
      ]
        .join(' ')
        .toLowerCase(),
    });
  }

  for (const photo of archive.photos) {
    // A photo with no caption is unfindable by anything but its year. Indexed
    // anyway so it still shows up under a decade filter.
    index.push({
      t: 'photo',
      y: photo.year,
      d: photo.year !== undefined ? decadeOf(photo.year) : undefined,
      l: photo.caption ?? `Photograph${photo.year ? `, ${photo.year}` : ''}`,
      s: photo.credit,
      h: photo.year !== undefined ? yearHref(photo.year) : href('/archives'),
      e: photo.eventId,
      x: sample(photo.year),
      k: [
        photo.caption ?? '',
        personAliasText(photo.personIds),
        photo.eventId ? aliasText(photo.eventId) : '',
        String(photo.year ?? ''),
      ]
        .join(' ')
        .toLowerCase(),
    });
  }

  return index;
}
