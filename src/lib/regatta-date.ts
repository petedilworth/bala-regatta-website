/**
 * The Bala Regatta is held on the Saturday of the August long weekend: the
 * Saturday before Ontario's Civic Holiday, which is the first Monday in August.
 *
 * That is not quite "the first Saturday in August", and the difference is
 * real. The two rules agree unless 1 August falls on a Sunday or Monday, when
 * the long-weekend Saturday is the last one in July. The programmes settle
 * it: 1988 (30 July), 1999 (31 July), 2016 (30 July) and 2022 (30 July) were
 * all run on the last Saturday of July, and the 2024 cover says outright
 * "the Saturday morning of the August 1st long weekend". So 2027 is 31 July,
 * not 7 August.
 *
 * The date used to be typed into settings.yaml and went stale the moment the
 * day passed. Now it is derived here at build time, and only the edition is
 * anchored (the 115th was 2026). deploy.yml rebuilds weekly so the computed
 * date cannot drift on a static site either.
 *
 * Pure: no Astro imports, so it can be checked with plain node.
 */

export type EditionAnchor = { year: number; edition: number };

/** The Saturday before the first Monday in August. May fall in July. */
export function regattaSaturday(year: number): Date {
  const aug1Weekday = new Date(Date.UTC(year, 7, 1)).getUTCDay(); // 0 = Sunday
  const firstMonday = 1 + ((8 - aug1Weekday) % 7);
  // Day 0 or -1 of August resolves to 31 or 30 July — Date handles the rollback.
  return new Date(Date.UTC(year, 7, firstMonday - 2));
}

/**
 * The next regatta as of `now`. The regatta day itself — and the Sunday
 * after, to cover Ontario's UTC offset — still count as "upcoming", so the
 * site does not flip to next year while the event is on.
 */
export function nextRegattaDate(now: Date = new Date()): Date {
  const y = now.getUTCFullYear();
  const thisYear = regattaSaturday(y);
  const grace = 2 * 24 * 60 * 60 * 1000;
  return thisYear.getTime() + grace > now.getTime() ? thisYear : regattaSaturday(y + 1);
}

/** Edition number for a year, counted from the anchor. Assumes no skipped years after it. */
export function editionFor(year: number, anchor: EditionAnchor): number {
  return anchor.edition + (year - anchor.year);
}
