import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
// Astro 7 deprecates re-exporting `z`; zod is imported directly instead.
import { z } from 'zod';

/**
 * The archive is data, not pages.
 *
 * Nothing here describes a page. These collections describe facts about the
 * regatta, and src/pages/ generates year, event and person views from them.
 * A single result entry therefore appears on its year page, on its event's
 * record book, on each linked person's page, and in the search index, while
 * only ever being typed once.
 *
 * Two rules make this survive 115 years of inconsistent records:
 *
 *  1. Events are referenced, never free-typed. An event's own file carries its
 *     historical aliases, so "Punting" in 1932 and "Punt Race" in 2024 are the
 *     same event. reference() makes the build fail on a typo instead of
 *     silently dropping a row out of every filter.
 *
 *  2. People are linked optionally and progressively. A result always stores
 *     the name exactly as the source printed it, because that is what an
 *     archive is for. Attaching a person reference is a separate, later act of
 *     judgement, so data entry never stalls on deciding whether two "J. Smith"s
 *     are one man.
 */

/** A person as printed on a source, optionally resolved to a person record. */
const competitor = z.object({
  /** Verbatim from the program or clipping — "Mrs. J. Smith", initials and all. */
  name: z.string(),
  /** Set only when you are confident of the identity. Safe to add years later. */
  person: reference('people').optional(),
});

const placing = z.object({
  /** Omit when a source records a winner without ranking the rest. */
  place: z.number().int().positive().optional(),
  competitors: z.array(competitor).min(1),
  /** Club, cottage, family or town, where the source gives one. */
  affiliation: z.string().optional(),
  time: z.string().optional(),
  note: z.string().optional(),
  /**
   * The trophy this placing won, where one was awarded. It sits on the placing
   * rather than the race because a trophy follows the winner: some are awarded
   * across several events, and a race can carry more than one.
   */
  trophy: reference('trophies').optional(),
});

const years = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/years' }),
  schema: z.object({
    year: z.number().int(),
    /** "115th" — not always year minus a constant; wars and weather interrupted. */
    edition: z.number().int().positive().optional(),
    date: z.coerce.date().optional(),
    /** Short line used on cards and search rows. */
    summary: z.string().optional(),
    location: z.string().default('Township Dock, Bala, Ontario'),
    /** Set when a year was cancelled or not held, so gaps are explicit not missing. */
    notHeld: z.boolean().default(false),
    notHeldReason: z.string().optional(),
    hero: z.string().optional(),
    draft: z.boolean().default(false),
    /**
     * Marks placeholder content shipped to demonstrate layout. Sample years
     * render a visible warning banner and must be deleted before the domain
     * cuts over — an archive that quietly mixes invented names into the record
     * is worse than an empty one.
     */
    sample: z.boolean().default(false),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    name: z.string(),
    /** Every historical spelling and rename. This is what makes the record book work. */
    aliases: z.array(z.string()).default([]),
    category: z.enum(['Swimming', 'Boating', 'Novelty', 'Junior', 'Other']),
    /** Roughly when it ran, for context on the event page. Both ends optional. */
    firstYear: z.number().int().optional(),
    lastYear: z.number().int().optional(),
    retired: z.boolean().default(false),
  }),
});

/**
 * Trophies are both a record and an object: they have a winner list running back
 * decades, and they physically exist and are worth photographing. Aliases matter
 * here for the same reason they do on events — a cup gets re-engraved, renamed
 * after a donor's death, and printed three ways across a century of programmes.
 */
const trophies = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/trophies' }),
  schema: z.object({
    name: z.string(),
    aliases: z.array(z.string()).default([]),
    /** Path under public/ to a photograph of the trophy itself. */
    photo: z.string().optional(),
    /** Who gave it, and when it was first awarded. */
    presentedBy: z.string().optional(),
    firstYear: z.number().int().optional(),
    lastYear: z.number().int().optional(),
    retired: z.boolean().default(false),
    /** The event it is normally awarded for, where it belongs to one. */
    event: reference('events').optional(),
    sample: z.boolean().default(false),
  }),
});

/**
 * Committee positions, referenced rather than typed for the same reason events
 * are. A succession is exactly the thing that breaks when "Commodore",
 * "commodore" and "Hon. Commodore" are three different strings — the holder
 * silently vanishes from the line rather than failing loudly.
 */
const offices = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/offices' }),
  schema: z.object({
    name: z.string(),
    aliases: z.array(z.string()).default([]),
    /** Flag officers head the association and get the succession table. */
    flagOfficer: z.boolean().default(false),
    /** Sort order within the table — Commodore 1, Vice 2, and so on. */
    rank: z.number().int().optional(),
    description: z.string().optional(),
  }),
});

const results = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml}', base: './src/content/results' }),
  schema: z.object({
    year: z.number().int(),
    /** Where these results came from, so a future reader can check the work. */
    source: z.string().optional(),
    races: z.array(
      z.object({
        event: reference('events'),
        /** Overrides the canonical name when the source's wording is worth showing. */
        titleAsPrinted: z.string().optional(),
        /** Absent placings are fine — some years only recorded a winner. */
        placings: z.array(placing).default([]),
        note: z.string().optional(),
      }),
    ),
  }),
});

const people = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/people' }),
  schema: z.object({
    name: z.string(),
    /** Maiden names, initials, misspellings — anything that should find this person. */
    aliases: z.array(z.string()).default([]),
    /** Leave unset unless known and appropriate to publish. */
    lifespan: z.string().optional(),
    photo: z.string().optional(),
    /** Suppresses the person page while keeping the name on results, on request. */
    hidden: z.boolean().default(false),
  }),
});

const roles = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml}', base: './src/content/roles' }),
  schema: z.object({
    year: z.number().int(),
    source: z.string().optional(),
    officials: z.array(
      z.object({
        /** Referenced, not typed — see the offices collection for why. */
        role: reference('offices'),
        /** Overrides the office name when the source's wording is worth showing. */
        titleAsPrinted: z.string().optional(),
        /** Same verbatim-plus-optional-link pattern as competitors. */
        name: z.string(),
        person: reference('people').optional(),
      }),
    ),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z
    .object({
      title: z.string(),
      publication: z.string().optional(),
      date: z.coerce.date().optional(),
      /**
       * One collection, three situations:
       *  link       — found online, summarised here, read there
       *  scan       — a clipping we hold, shown as an image or PDF
       *  transcript — retyped into this file's body, fully searchable
       */
      kind: z.enum(['link', 'scan', 'transcript']),
      url: z.url().optional(),
      /** Path under public/ for a scan or PDF. */
      file: z.string().optional(),
      summary: z.string().optional(),
      /** Regatta years this piece covers, so it surfaces on those year pages. */
      years: z.array(z.number().int()).default([]),
      people: z.array(reference('people')).default([]),
      draft: z.boolean().default(false),
    })
    .refine((a) => a.kind !== 'link' || !!a.url, {
      message: 'kind "link" needs a url',
      path: ['url'],
    })
    .refine((a) => a.kind !== 'scan' || !!a.file, {
      message: 'kind "scan" needs a file',
      path: ['file'],
    }),
});

const documents = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml}', base: './src/content/documents' }),
  schema: z.object({
    title: z.string(),
    kind: z.enum(['program', 'results-sheet', 'poster', 'minutes', 'other']),
    year: z.number().int().optional(),
    /** Path under public/ — the PDF or image itself. */
    file: z.string(),
    /** First-page image. PDFs embedded inline behave badly on phones, so year
     *  pages show this and link out to the file rather than framing it. */
    thumbnail: z.string().optional(),
    pages: z.number().int().positive().optional(),
    description: z.string().optional(),
  }),
});

const photos = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml}', base: './src/content/photos' }),
  schema: z.object({
    year: z.number().int().optional(),
    items: z.array(
      z.object({
        file: z.string(),
        /** Photos are findable only by caption and year. No caption, no search hit. */
        caption: z.string().optional(),
        credit: z.string().optional(),
        people: z.array(reference('people')).default([]),
        event: reference('events').optional(),
      }),
    ),
  }),
});

const sponsors = defineCollection({
  loader: file('./src/content/sponsors/sponsors.yaml'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    tier: z.enum(['major', 'supporting', 'thanks']).default('supporting'),
    url: z.url().optional(),
    phone: z.string().optional(),
    logo: z.string().optional(),
    /** Lets a sponsor drop off next year's site without deleting their history. */
    active: z.boolean().default(true),
  }),
});

/** Single-entry collection for the handful of values that change yearly. */
const settings = defineCollection({
  loader: file('./src/content/settings/settings.yaml'),
  schema: z.object({
    id: z.string(),
    nextRegattaDate: z.coerce.date().optional(),
    nextRegattaEdition: z.number().int().positive().optional(),
    registrationUrl: z.url().optional(),
    registrationNote: z.string().optional(),
    email: z.string().optional(),
    facebook: z.url().optional(),
    instagram: z.url().optional(),
    /** The curated strip on /archives. Hand-picked, so it needs an occasional look. */
    featured: z
      .array(
        z.object({
          label: z.string(),
          blurb: z.string().optional(),
          href: z.string(),
          image: z.string().optional(),
        }),
      )
      .default([]),
  }),
});

export const collections = {
  years,
  events,
  trophies,
  offices,
  results,
  people,
  roles,
  articles,
  documents,
  photos,
  sponsors,
  settings,
};
