import 'server-only';
import type { RawMatchesResponse } from './types';

/**
 * The single server-side entry point to football-data.org.
 *
 * The API key never leaves the server. Every client in the app reads our own
 * cached route handlers — this function is the *only* place we touch upstream,
 * which is what keeps us inside the free tier regardless of user count.
 */

const BASE = 'https://api.football-data.org/v4';
const COMPETITION = 'WC';

export class FootballDataError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'FootballDataError';
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Invalid API key configured on server.',
  403: 'API key does not cover the World Cup competition.',
  429: 'Rate limit reached (10 req/min). Please wait a moment.',
};

interface FetchOpts {
  /** Seconds Next should cache this fetch at the data layer. */
  revalidate: number;
}

async function get<T>(path: string, { revalidate }: FetchOpts): Promise<T> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new FootballDataError(
      500,
      'API key not configured. Add FOOTBALL_DATA_API_KEY to your environment.',
    );
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'X-Auth-Token': apiKey },
      next: { revalidate },
    });
  } catch (err) {
    throw new FootballDataError(
      502,
      `Upstream fetch failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    );
  }

  if (!res.ok) {
    throw new FootballDataError(
      res.status,
      STATUS_MESSAGES[res.status] ?? `Upstream API error ${res.status}`,
    );
  }

  return (await res.json()) as T;
}

/**
 * Full tournament schedule + results in one call (~104 matches).
 *
 * `revalidate` defaults differ by intent:
 *  - schedule view: long (kickoff times rarely change) — 1 hour
 *  - live view: short (delayed scores still move) — callers pass a small value
 */
export function getWorldCupMatches(revalidate = 3600): Promise<RawMatchesResponse> {
  return get<RawMatchesResponse>(`/competitions/${COMPETITION}/matches`, {
    revalidate,
  });
}
