import { NextResponse } from 'next/server';
import { FootballDataError, getWorldCupMatches } from '@/lib/football/client';
import { normalizeMatches } from '@/lib/football/normalize';

/**
 * Live endpoint: only the matches in-play (or just finished), for the live strip.
 *
 * Shares one Data Cache entry with /api/matches (same upstream URL + revalidate),
 * so it adds zero extra upstream calls. Honesty note: football-data's free tier
 * scores are *delayed*, not real-time; `delayedSource` lets the UI show a "may
 * lag" hint rather than implying instantaneous data.
 */

export const revalidate = 60;

export async function GET() {
  try {
    const raw = await getWorldCupMatches();
    const all = normalizeMatches(raw.matches ?? []);
    const live = all.filter((m) => m.phase === 'live' || m.phase === 'finished');

    return NextResponse.json(
      {
        matches: live,
        liveCount: live.filter((m) => m.phase === 'live').length,
        updatedAt: new Date().toISOString(),
        delayedSource: true,
      },
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
