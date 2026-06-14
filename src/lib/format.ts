/**
 * Date/time formatting in the viewer's local timezone.
 *
 * These read the browser's locale/timezone, so they must only run client-side
 * (after mount) to avoid SSR hydration mismatches.
 */

/**
 * Named local timezone abbreviation, e.g. "IST", "PDT", "JST".
 *
 * The browser's `short` form only yields a named abbreviation when the locale
 * matches the region (an en-US browser in India gets "GMT+5:30", not "IST").
 * So when `short` returns a bare GMT/UTC offset, we derive the abbreviation from
 * the initials of the English long name ("India Standard Time" → "IST").
 */
export function localTzAbbrev(): string {
  const part = (locale: string, name: 'short' | 'long') =>
    new Intl.DateTimeFormat(locale, { timeZoneName: name })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value ?? '';

  const short = part('default', 'short');
  // A real abbreviation (UTC, PDT, IST) — not a "GMT+5:30"/"UTC-3" offset.
  if (short && !/(GMT|UTC)[+-]/i.test(short)) return short;

  const long = part('en', 'long');
  const abbr = long
    .split(' ')
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join('');
  return abbr || short;
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** "07:00 PM GMT+5:30" — with timezone, for standalone/contextual use. */
export function kickoffTime(ms: number): string {
  try {
    const t = new Date(ms)
      .toLocaleString(navigator.language, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
      .toUpperCase();
    return `${t} ${localTzAbbrev()}`;
  } catch {
    return '—';
  }
}

/** "07:00 PM" — no timezone, for compact cards/rows where TZ is stated nearby. */
export function kickoffTimeShort(ms: number): string {
  try {
    return new Date(ms)
      .toLocaleString(navigator.language, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
      .toUpperCase();
  } catch {
    return '—';
  }
}

/** "13 June 2026" */
export function kickoffDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString(navigator.language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/** Local YYYY-MM-DD for a given epoch (used to match a date-picker value). */
export function localDateKey(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: localTimeZone() });
}

/** Human "in 5 hours" / "in 45 min" / "in 2 days" until kickoff, or null if past. */
export function relativeKickoff(ms: number): string | null {
  const diff = ms - Date.now();
  if (diff <= 0) return null;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'kicking off';
  if (min < 60) return `in ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/** Current local time "7:32 PM". */
export function localClock(now: Date): string {
  return now
    .toLocaleTimeString(navigator.language, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toUpperCase();
}

/** Compact "Sat, Jun 28 · 07:00 PM" for list rows. */
export function shortDateTime(ms: number): string {
  return new Date(ms).toLocaleString(navigator.language, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
