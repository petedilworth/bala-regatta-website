/**
 * Base-aware URL builder.
 *
 * The site currently publishes under a sub-path (project GitHub Pages) and will
 * move to the domain root at cutover. Astro does not rewrite hrefs, so every
 * internal link and asset path must go through here or it breaks on one of the
 * two. There is no third option worth having: hardcoding "/" works only after
 * cutover, hardcoding the sub-path only before it.
 */
export function href(path = '/'): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;

  // Page URLs get a trailing slash to match trailingSlash: 'always'. Without it a
  // request for /schedule resolves to the schedule.html redirect stub instead of
  // the real page — see the comment in astro.config.mjs. Asset paths are left
  // alone, since a file has an extension and must not gain a slash.
  const lastSegment = suffix.slice(suffix.lastIndexOf('/') + 1);
  const isFile = lastSegment.includes('.');
  const normalized = isFile || suffix.endsWith('/') ? suffix : `${suffix}/`;

  return `${base}${normalized}` || '/';
}

/** Absolute URL, for canonical tags, Open Graph and feeds. */
export function absolute(path = '/'): string {
  return new URL(href(path), import.meta.env.SITE ?? 'https://balaregatta.com').toString();
}

export function yearHref(year: number): string {
  return href(`/archives/${year}`);
}

export function eventHref(id: string): string {
  return href(`/archives/events/${id}`);
}

export function personHref(id: string): string {
  return href(`/archives/people/${id}`);
}
