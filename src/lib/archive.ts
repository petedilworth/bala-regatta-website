import { getCollection, type CollectionEntry } from 'astro:content';
import { href, personHref, trophyHref, yearHref } from './url';
import { documentLabel, type RecordType } from './record-types';

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
  trophyId?: string;
  trophyName?: string;
};

export type Official = {
  year: number;
  officeId: string;
  /** Canonical office name — what a succession groups by. */
  officeName: string;
  /** What to show: the source's wording where it gave one, else the canonical name. */
  role: string;
  rank?: number;
  flagOfficer: boolean;
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
type TrophyEntry = CollectionEntry<'trophies'>;
type OfficeEntry = CollectionEntry<'offices'>;

export type Archive = {
  years: YearEntry[];
  yearsByNumber: Map<number, YearEntry>;
  events: EventEntry[];
  eventsById: Map<string, EventEntry>;
  trophies: TrophyEntry[];
  trophiesById: Map<string, TrophyEntry>;
  offices: OfficeEntry[];
  officesById: Map<string, OfficeEntry>;
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
  rowsByTrophy: Map<string, ResultRow[]>;
  officialsByYear: Map<number, Official[]>;
  officialsByPerson: Map<string, Official[]>;
  officialsByOffice: Map<string, Official[]>;
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

/**
 * Resolves a reference, or stops the build.
 *
 * This is load-bearing, and not what it looks like. Astro's reference() validates
 * the *shape* of a reference — that it is a { collection, id } pair — but never
 * that the id points at a file that exists. Existence is only checked if you call
 * getEntry(), and this module deliberately does not: a century of results is tens
 * of thousands of lookups, so everything resolves through the maps above.
 *
 * The consequence, before this function existed, was the exact failure the content
 * model is designed to prevent: `event: punt-rase` built cleanly and silently
 * dropped every placing in that race out of the year page, the record book, the
 * person pages and search. Nothing anywhere said so.
 *
 * So the guarantee the README makes — a typo fails the build — is made here.
 */
function resolveRef<T>(
  map: Map<string, T>,
  id: string,
  collection: string,
  where: string,
): T {
  const found = map.get(id);
  if (!found) {
    throw new Error(
      `Unknown ${collection} "${id}", referenced by ${where}.\n` +
        `  Expected a file at src/content/${collection}/${id}.(md|yaml).\n` +
        `  Either the id is misspelt, or the ${collection} entry has not been created yet.`,
    );
  }
  return found;
}

export async function getArchive(): Promise<Archive> {
  if (cached) return cached;

  const isPublished = (entry: { data: { draft?: boolean } }) =>
    import.meta.env.DEV || entry.data.draft !== true;

  const [years, events, trophies, offices, results, people, roles, articles, documents, photoSets] =
    await Promise.all([
      getCollection('years', isPublished),
      getCollection('events'),
      getCollection('trophies'),
      getCollection('offices'),
      getCollection('results'),
      getCollection('people'),
      getCollection('roles'),
      getCollection('articles', isPublished),
      getCollection('documents'),
      getCollection('photos'),
    ]);

  const eventsById = new Map(events.map((e) => [e.id, e]));
  const trophiesById = new Map(trophies.map((t) => [t.id, t]));
  const officesById = new Map(offices.map((o) => [o.id, o]));
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const yearsByNumber = new Map(years.map((y) => [y.data.year, y]));

  for (const trophy of trophies) {
    if (trophy.data.event) {
      resolveRef(eventsById, trophy.data.event.id, 'events', `trophies/${trophy.id}`);
    }
  }

  const rows: ResultRow[] = [];
  const rowsByYear = new Map<number, ResultRow[]>();
  const rowsByEvent = new Map<string, ResultRow[]>();
  const rowsByPerson = new Map<string, ResultRow[]>();
  const rowsByTrophy = new Map<string, ResultRow[]>();

  for (const sheet of results) {
    const sheetName = `results/${sheet.id}`;
    for (const race of sheet.data.races) {
      const event = resolveRef(eventsById, race.event.id, 'events', sheetName);

      for (const placing of race.placings) {
        const competitors: Competitor[] = placing.competitors.map((c) => {
          const person = c.person
            ? resolveRef(peopleById, c.person.id, 'people', `${sheetName} (${c.name})`)
            : undefined;
          // A hidden person is resolved and then deliberately unlinked, which is a
          // different thing from a person who could not be found.
          const linkable = person && person.data.hidden !== true;
          return {
            name: c.name,
            personId: linkable ? person.id : undefined,
            href: linkable ? personHref(person.id) : undefined,
          };
        });

        const trophy = placing.trophy
          ? resolveRef(trophiesById, placing.trophy.id, 'trophies', sheetName)
          : undefined;

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
          trophyId: trophy?.id,
          trophyName: trophy?.data.name,
        };

        rows.push(row);
        push(rowsByYear, row.year, row);
        push(rowsByEvent, row.eventId, row);
        if (row.trophyId) push(rowsByTrophy, row.trophyId, row);
        for (const c of competitors) {
          if (c.personId) push(rowsByPerson, c.personId, row);
        }
      }
    }
  }

  const officials: Official[] = [];
  const officialsByYear = new Map<number, Official[]>();
  const officialsByPerson = new Map<string, Official[]>();
  const officialsByOffice = new Map<string, Official[]>();

  for (const sheet of roles) {
    const sheetName = `roles/${sheet.id}`;
    for (const entry of sheet.data.officials) {
      const office = resolveRef(officesById, entry.role.id, 'offices', sheetName);
      const person = entry.person
        ? resolveRef(peopleById, entry.person.id, 'people', `${sheetName} (${entry.name})`)
        : undefined;
      const linkable = person && person.data.hidden !== true;
      const official: Official = {
        year: sheet.data.year,
        officeId: office.id,
        officeName: office.data.name,
        role: entry.titleAsPrinted ?? office.data.name,
        rank: office.data.rank,
        flagOfficer: office.data.flagOfficer,
        name: entry.name,
        personId: linkable ? person.id : undefined,
        href: linkable ? personHref(person.id) : undefined,
      };
      officials.push(official);
      push(officialsByYear, official.year, official);
      push(officialsByOffice, official.officeId, official);
      if (official.personId) push(officialsByPerson, official.personId, official);
    }
  }

  const articlesByYear = new Map<number, ArticleEntry[]>();
  const articlesByPerson = new Map<string, ArticleEntry[]>();
  for (const article of articles) {
    for (const year of article.data.years) push(articlesByYear, year, article);
    for (const ref of article.data.people) {
      resolveRef(peopleById, ref.id, 'people', `articles/${article.id}`);
      push(articlesByPerson, ref.id, article);
    }
  }

  const documentsByYear = new Map<number, DocumentEntry[]>();
  for (const doc of documents) {
    if (doc.data.year !== undefined) push(documentsByYear, doc.data.year, doc);
  }

  const photos: PhotoItem[] = [];
  const photosByYear = new Map<number, PhotoItem[]>();
  const photosByPerson = new Map<string, PhotoItem[]>();
  for (const set of photoSets) {
    const setName = `photos/${set.id}`;
    for (const item of set.data.items) {
      if (item.event) resolveRef(eventsById, item.event.id, 'events', setName);
      const photo: PhotoItem = {
        year: set.data.year,
        file: item.file,
        caption: item.caption,
        credit: item.credit,
        personIds: item.people.map((p) => {
          resolveRef(peopleById, p.id, 'people', setName);
          return p.id;
        }),
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
    trophies: [...trophies].sort((a, b) => a.data.name.localeCompare(b.data.name)),
    trophiesById,
    // Flag officers first and in rank order; everything else alphabetically after.
    offices: [...offices].sort((a, b) => {
      if (a.data.flagOfficer !== b.data.flagOfficer) return a.data.flagOfficer ? -1 : 1;
      const rankA = a.data.rank ?? Number.MAX_SAFE_INTEGER;
      const rankB = b.data.rank ?? Number.MAX_SAFE_INTEGER;
      return rankA !== rankB ? rankA - rankB : a.data.name.localeCompare(b.data.name);
    }),
    officesById,
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
    rowsByTrophy,
    officialsByYear,
    officialsByPerson,
    officialsByOffice,
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
  t: RecordType;
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

  // Trophy aliases work like event aliases: a cup that was re-engraved or renamed
  // still finds every year it was won under its older wording.
  const trophyAliasText = (id?: string) => {
    if (!id) return '';
    const trophy = archive.trophiesById.get(id);
    return trophy ? [trophy.data.name, ...trophy.data.aliases].join(' ') : '';
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
        trophyAliasText(row.trophyId),
        row.printedName ?? '',
        row.affiliation ?? '',
        String(row.year),
        decadeOf(row.year),
      ]
        .join(' ')
        .toLowerCase(),
    });
  }

  for (const trophy of archive.trophies) {
    const wins = archive.rowsByTrophy.get(trophy.id) ?? [];
    const yearsWon = wins.map((w) => w.year).sort((a, b) => a - b);
    index.push({
      t: 'trophy',
      // Undated so it survives every decade filter — a trophy spans decades and
      // pinning it to one would hide it from the others.
      l: trophy.data.name,
      s: yearsWon.length
        ? `Trophy · ${yearsWon.length} ${yearsWon.length === 1 ? 'win' : 'wins'} recorded`
        : 'Trophy',
      h: trophyHref(trophy.id),
      e: trophy.data.event?.id,
      x: trophy.data.sample ? 1 : undefined,
      k: [
        trophy.data.name,
        ...trophy.data.aliases,
        trophy.data.presentedBy ?? '',
        trophy.data.event ? aliasText(trophy.data.event.id) : '',
        yearsWon.join(' '),
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
        // Both the canonical office and the source's wording, so "Hon. Commodore"
        // and "Commodore" each find the row.
        official.officeName,
        official.role,
        ...(archive.officesById.get(official.officeId)?.data.aliases ?? []),
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
      s: documentLabel(doc.data.kind),
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
        photo.credit ?? '',
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
