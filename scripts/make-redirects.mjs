/**
 * Generates redirect stubs for the old Weebly URLs into public/.
 *
 * GitHub Pages has no redirect configuration, so the closest available thing to a
 * 301 is a real .html file at the old path containing a meta refresh and a
 * canonical link. Astro's own `redirects` option cannot be used here: under
 * build.format 'directory' it produces a directory named "about.html", which
 * Pages will not reliably serve for a request to /about.html.
 *
 * The refresh targets are deliberately RELATIVE, and deliberately end in a
 * trailing slash. Relative keeps them correct both under today's project Pages
 * sub-path and at the domain root after cutover, so this list needs no edit on
 * the day. The trailing slash is what stops a loop: without it, 'about' resolves
 * back to this very stub (about.html) rather than to the real page at about/.
 *
 * INCOMPLETE. This map was assembled from search results, because the live site
 * could not be crawled from the build environment. Before cutover, crawl the real
 * Weebly site, add every URL it serves, and delete any guesses below that turn out
 * not to exist — a stub for a URL nobody ever linked is harmless, but a missing
 * stub for a page with inbound links loses that traffic.
 *
 * Run automatically via the `prebuild` npm script.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

/** old Weebly path -> new path, relative to the site root (no leading slash). */
const redirects = {
  'home.html': '',
  'about.html': 'about/',
  'sponsors.html': 'sponsors/',
  'contact.html': 'contact/',
  'registration.html': 'register/',
  'register.html': 'register/',
  'schedule.html': 'schedule/',
  'schedule-events.html': 'schedule/',
  'schedule--events.html': 'schedule/',
  'events.html': 'schedule/',
  'galleries.html': 'archives/',
  'gallery.html': 'archives/',
  'photos.html': 'archives/',
  'history.html': 'archives/',
  '2025.html': 'archives/2025/',
  // Point year pages at /archives/ until that year actually has a page, otherwise
  // the stub sends visitors to a 404 — worse than sending them to the index.
  '2014-regatta.html': 'archives/',
  '1950s.html': 'archives/',
};

const page = (target) => {
  // "./" keeps an empty target (the home page) resolving to the site root rather
  // than to the stub itself.
  const to = target === '' ? './' : target;
  return `<!doctype html>
<html lang="en-CA">
  <head>
    <meta charset="utf-8" />
    <title>Page moved — Bala Regatta</title>
    <link rel="canonical" href="${to}" />
    <meta http-equiv="refresh" content="0; url=${to}" />
    <meta name="robots" content="noindex" />
  </head>
  <body>
    <p>This page has moved. <a href="${to}">Continue to the Bala Regatta site</a>.</p>
  </body>
</html>
`;
};

let written = 0;
for (const [from, to] of Object.entries(redirects)) {
  const file = join(publicDir, from);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, page(to), 'utf8');
  written += 1;
}

console.log(`make-redirects: wrote ${written} redirect stubs to public/`);
