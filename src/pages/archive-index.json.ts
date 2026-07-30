import type { APIRoute } from 'astro';
import { buildSearchIndex } from '../lib/archive';

/**
 * The whole archive as one JSON file, fetched by /archives on load.
 *
 * Shipping it separately from the HTML keeps the page small and lets the browser
 * cache the index across visits. At the full 115 years this is expected to be a
 * few hundred kilobytes, which is well inside what a static host can serve for
 * free — and it means search needs no server, no database and no ongoing cost.
 */
export const GET: APIRoute = async () => {
  const index = await buildSearchIndex();

  return new Response(JSON.stringify(index), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
