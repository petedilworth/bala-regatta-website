import { defineConfig } from 'astro/config';

/**
 * Hosting: GitHub Pages.
 *
 * Until balaregatta.com is transferred off Weebly/Square, the site publishes to
 * the project Pages URL, which lives under a sub-path. At cutover, set these two
 * env vars in the deploy workflow and add public/CNAME:
 *
 *   SITE_URL=https://balaregatta.com
 *   SITE_BASE=/
 *
 * Nothing else needs to change, because every internal link goes through the
 * href() helper in src/lib/url.ts.
 */
const SITE_URL = process.env.SITE_URL ?? 'https://petedilworth.github.io';
const SITE_BASE = process.env.SITE_BASE ?? '/bala-regatta-website';

export default defineConfig({
  site: SITE_URL,
  base: SITE_BASE,
  /**
   * 'always' is load-bearing, not cosmetic.
   *
   * A static host asked for /schedule tries schedule.html before
   * schedule/index.html. Since the old Weebly URLs are real files at exactly
   * those names, an extension-less /schedule would resolve to the redirect stub,
   * which points back at /schedule — an infinite loop on every page whose old
   * name matches its new one. Serving canonical pages at /schedule/ removes the
   * ambiguity: a trailing slash can only ever mean the directory.
   */
  trailingSlash: 'always',
  output: 'static',
  build: {
    format: 'directory',
  },
  /**
   * Old Weebly URLs are NOT handled by Astro's `redirects` option.
   *
   * With build.format 'directory' that option emits dist/about.html/index.html —
   * a directory named "about.html" — and GitHub Pages is not reliably willing to
   * serve that for a request to /about.html. Since preserving inbound links is
   * the entire job of these redirects, they are generated instead as real files
   * by scripts/make-redirects.mjs, which runs on prebuild. See that file for the
   * URL map.
   */
});
