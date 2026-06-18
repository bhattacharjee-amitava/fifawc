import { NextResponse } from 'next/server';
import { FootballDataError, getWorldCupMatches } from '@/lib/football/client';
import { normalizeMatches } from '@/lib/football/normalize';

/**
 * Schedule endpoint: the full tournament, normalized and chronologically sorted.
 *
 * Upstream is reached only through Next's Data Cache (see client.ts). On Vercel
 * that cache is shared + persistent across every function instance and region, so
 * football-data is hit ~once per `revalidate` window *globally* — independent of
 * how many devices connect or how often they refresh. That's what keeps us inside
 * the free tier (10 req/min) with no cron, no KV, and no paid plan.
 *
 * Note: /api/live fetches the SAME upstream URL with the SAME revalidate, so both
 * routes share a single cache entry and a single upstream call.
 */

export const revalidate = 60;

export async function GET() {
  try {
    const raw = await getWorldCupMatches();
    const matches = normalizeMatches(raw.matches ?? []);

    return NextResponse.json(
      { matches, count: matches.length, updatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (err) {
    const status = err instanceof FootballDataError ? err.status : 500;
    const error = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error }, { status });
  }
}
