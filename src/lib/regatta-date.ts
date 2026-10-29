/**
 * The Bala Regatta is held on the first Saturday in August, every year.
 *
 * The date used to be typed into settings.yaml and went stale the moment the
 * day passed — the site kept announcing a regatta that had already happened.
 * Now it is derived from the rule at build time, and only the edition is
 * anchored (the 115th was 2026). deploy.yml rebuilds weekly so the computed
 * date cannot drift on a static site either.
 *
 * Pure: no Astro imports, so it can be unit-tested with plain node.
 */

export type EditionAnchor = { year: number; edition: number };

export function firstSaturdayInAugust(year: number): Date {
  const d = new Date(Date.UTC(year, 7, 1));
  d.setUTCDate(1 + ((6 - d.getUTCDay() + 7) % 7));
  return d;
}

/**
 * The next regatta as of `now`. The regatta day itself — and the Sunday
 * after, to cover Ontario's UTC offset — still count as "upcoming", so the
 * site does not flip to next year while the event is on.
 */
export function nextRegattaDate(now: Date = new Date()): Date {
  const y = now.getUTCFullYear();
  const thisYear = firstSaturdayInAugust(y);
  const grace = 2 * 24 * 60 * 60 * 1000;
  return thisYear.getTime() + grace > now.getTime() ? thisYear : firstSaturdayInAugust(y + 1);
}

/** Edition number for a year, counted from the anchor. Assumes no skipped years after it. */
export function editionFor(year: number, anchor: EditionAnchor): number {
  return anchor.edition + (year - anchor.year);
}
