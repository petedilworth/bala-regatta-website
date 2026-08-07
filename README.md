# Bala Regatta

Website and historical archive for the Bala Regatta, held each summer at the Township
Dock in Bala, Muskoka.

Built with [Astro](https://astro.build), published as a static site to GitHub Pages.
Hosting is free; the only running cost is the domain.

```bash
npm install
npm run dev      # local preview at http://localhost:4321/bala-regatta-website/
npm run build    # production build into dist/
npm run check    # type + content-schema check (run before pushing)
```

---

## Before this goes live

**Sample content has been removed.** The invented placeholder names, results and
photos used to review the layout are gone from the repository. Every year, person,
document, photo and trophy currently in the archive is real.

A page can still carry the sample banner and a search row can still be tagged
`sample` — the mechanism (`sample: true` on a `years` or `trophies` entry) is kept
for future review batches, it's just unused right now.

Work through the `.todo` boxes visible on the pages themselves — they mark every
place waiting on something only the committee can supply.

---

## The three sections

The public site is deliberately small: **Home**, **Event Program** and **Archives**.
The About, Schedule, Register, Sponsors and Contact pages that came with the original
scaffold have been removed — contact is now just an email address in the footer.

`sponsors.yaml` and the `registrationUrl` setting are still in the repo, unused. Either
page can come back without retyping anything; nothing was thrown away but the templates.

Home and Event Program are intentionally near-empty for now.

### Colour and the logo

The palette is the logo's and only the logo's: navy, sky blue, white. It lives in
`src/styles/global.css` — see the comment at the top of that file before changing a
value.

One rule matters more than the rest. **The logo's sky blue is about 1.9:1 on white,
which fails WCAG AA at every size, so `--sky` must never carry text.** Use it for
circles, rules and decoration; use `--navy` or `--blue-ink` (that same blue, darkened
until it passes) for anything readable. The current-page marker in the header uses
`--accent` for the same reason: which page you are on is a state, not decoration.

There is no dark mode. It was removed deliberately — the logo is navy-on-white, and
inverting it produced a second, unowned brand.

**The logo artwork is not in the repo yet.** The header and the homepage both render a
text wordmark in its place, each marked with a comment. Drop the real file into
`src/images/`, swap those two blocks for it, and add a favicon — `Base.astro` currently
has no `<link rel="icon">` at all.

---

## How the content works

**You write records, not pages.** Nothing in `src/content/` describes a page. The site
generates year, event and person pages from the data, so one result entry appears on its
year page, in its event's record book, on each linked person's page, and in search —
typed once.

Everything lives in `src/content/`:

| Folder | What goes in it |
|---|---|
| `years/` | One Markdown file per regatta year, with a short narrative |
| `results/` | One YAML file per year, listing events and placings |
| `events/` | One file per event, **with its historical aliases** |
| `trophies/` | One file per cup, with its aliases, donor and photograph |
| `offices/` | Committee positions — Commodore, Secretary — with their aliases |
| `people/` | Competitors and organisers, with name variants |
| `roles/` | Who held which office, per year |
| `articles/` | Press coverage — linked, scanned, or transcribed |
| `documents/` | Programmes, results sheets, posters |
| `photos/` | Photographs, grouped by year, with captions |
| `sponsors/` | The sponsor list |
| `settings/` | Regatta date, registration link, contact details, featured items |

Images and PDFs go in `public/archives/<year>/` and are referenced by path.

### The two halves of the archive

`/archives` presents the collection as two doors, because it holds two different
kinds of thing:

- **The record** — facts broken into rows. Results, officers and trophies, which
  generate the year, event, person, trophy and officer pages.
- **The collection** — the artifacts themselves, browsed visually at
  `/archives/gallery`: scanned programmes, photographs, press clippings and
  photographs of the trophies.

The gallery is assembled from `photos/`, `documents/`, scanned `articles/` and any
trophy with a `photo`. It has no collection of its own, so nothing needs filing
twice — and a photograph still cannot be given a page count.

### Adding a year

1. `src/content/years/1963.md` — front matter with `year`, and prose in the body.
2. `src/content/results/1963.yaml` — the races. See `src/content/results/1947.yaml`
   for the shape.
3. Optionally `roles/1963.yaml`, `photos/1963.yaml`, and documents.

### Two rules worth understanding

**Events, trophies and offices are referenced, never typed.** A results file says
`event: punt-race`, which must match a filename in `src/content/events/`. A typo **fails
the build** rather than silently dropping the row out of every filter. When you find an
old programme calling it something else, add that wording to `aliases:` in the event file
— do not create a second event. Aliases are what keep a record book continuous across a
century of renames. The same applies to `trophy:` on a placing and `role:` on an official.

That guarantee is enforced by `resolveRef()` in `src/lib/archive.ts`, and it has to be.
Astro's `reference()` validates the *shape* of a reference but **not** that its target
exists — existence is only checked by `getEntry()`, which this codebase deliberately does
not call, because a century of results is tens of thousands of lookups. Without that
function `event: punt-rase` builds cleanly and silently erases the race. If you add a new
reference field, resolve it through `resolveRef()` or you lose the guarantee.

**People are linked optionally.** A result always records the name exactly as the source
printed it (`Mrs. J. Smith`, initials and all) — that is what an archive is for. Adding
`person: jane-smith` is a separate judgement about identity, and can be done years later
without retyping anything. Unlinked names stay fully searchable; they just do not get a
person page.

To keep someone's name in the results but remove their personal page, set `hidden: true`
on their person file rather than deleting it.

---

## How search works

`/archives` fetches `archive-index.json`, built at compile time from every record, and
filters it in the browser. No server, no database, nothing beyond the free hosting tier.

Measured at **~310 bytes per record**. At the full 115 years — very roughly 10,000
records — that is around 3 MB raw, or roughly 700 KB gzipped, fetched once and then
cached. Fine, but if it becomes uncomfortable the fix is to trim the `k` haystack field
in `src/lib/archive.ts` or split the index by decade. Worth re-measuring once a few real
decades are in.

Photos are findable by their **caption and year only**. An uncaptioned photo will surface
under a decade filter and nowhere else, so caption them as you upload.

---

## Old Weebly URLs

`scripts/make-redirects.mjs` generates a real `.html` file at each old Weebly path
containing a meta refresh — the closest GitHub Pages gets to a 301. It runs automatically
on `npm run build`; the generated files are gitignored.

Two non-obvious constraints, both already handled, both easy to break:

- **Targets must end in a trailing slash.** A static host asked for `/schedule` serves
  `schedule.html` before `schedule/index.html`. Since the stub *is* `schedule.html`, a
  target of `schedule` points at itself — an infinite redirect loop. `schedule/` can only
  mean the directory. This is also why `astro.config.mjs` sets
  `trailingSlash: 'always'`, and why internal links go through `href()` in
  `src/lib/url.ts` rather than being written by hand.
- **The URL list is incomplete.** It was assembled from search results, because the live
  site could not be crawled from the build environment. Crawl the real Weebly site and
  add every URL it serves before cutover.

Because the site is now three sections, the old `schedule`/`register` URLs point at
`program/`, and `about`/`sponsors`/`contact` point at the home page. Any stub whose
target no longer exists sends visitors to a 404, which is worse than sending them to the
index — re-point rather than delete when a page goes away.

---

## Deploying

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.

GitHub Pages needs the repository to be **public** on a free plan. Note that anything
committed stays in the Git history even after deletion — so do not commit a scan whose
rights are unclear.

### Cutover checklist

The domain is the one irreversible step, so it goes last.

1. Crawl and archive the existing Weebly site; complete the redirect URL list.
2. Add the logo artwork and a favicon, and fill in the `.todo` items.
3. Confirm whether any address `@balaregatta.com` is in use. **If so, its MX records must
   be carried across or mail stops.**
4. Transfer the domain out of Weebly/Square to a normal registrar — unlock, get the
   EPP/auth code, transfer (5–7 days).
5. Add `public/CNAME` containing `balaregatta.com`, and set the workflow env vars to
   `SITE_URL: https://balaregatta.com` and `SITE_BASE: /`.
6. Point the apex A records and the `www` CNAME at GitHub Pages; wait for the HTTPS
   certificate.
7. Confirm the site resolves over HTTPS, **then** confirm email still delivers, **then**
   cancel Weebly.

---

## Notes on the archive itself

`/archives/corrections` publishes commitments about naming living people and handling
photograph rights. Those are a sensible default, not a ratified policy — the committee
should read that page and change it to match what the association will actually do.
