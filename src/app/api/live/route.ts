import { NextResponse } from 'next/server';
import { FootballDataError, getWorldCupMatches } from '@/lib/football/client';
import { normalizeMatches } from '@/lib/football/normalize';

/**
 * Live endpoint: only the matches that are in-play (or just finished), with a
 * short cache so delayed-but-official scores surface quickly.
 *
 * Honesty note: football-data's free tier scores are *delayed*, not real-time.
 * `staleSeconds` communicates the cache age so the UI can show a "may lag" hint
 * rather than implying instantaneous data.
 */

export const revalidate = 30; // seconds

export async function GET() {
  try {
    const raw = await getWorldCupMatches(revalidate);
    const all = normalizeMatches(raw.matches ?? []);
    const live = all.filter(
      (m) => m.phase === 'live' || m.phase === 'finished',
    );

    return NextResponse.json(
      {
        matches: live,
        liveCount: live.filter((m) => m.phase === 'live').length,
        updatedAt: new Date().toISOString(),
        delayedSource: true, // UI uses this to render the "official · may lag" hint
      },
      {
        headers: {
          'Cache-Control': 's-maxage=30, stale-while-revalidate=15',
        },
      },
    );
  } catch (err) {
    const status = err instanceof FootballDataError ? err.status : 500;
    const error = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error }, { status });
  }
}
