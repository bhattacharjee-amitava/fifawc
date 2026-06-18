import { NextResponse } from 'next/server';
import { ensureSnapshot } from '@/lib/football/store';
import { normalizeMatches } from '@/lib/football/normalize';

/**
 * Live endpoint: only the matches in-play (or just finished), for the live strip.
 *
 * Reads the same in-process snapshot as /api/matches (see lib/football/store) —
 * no separate upstream call. Honesty note: football-data's free tier scores are
 * *delayed*, not real-time; `delayedSource` lets the UI show a "may lag" hint, and
 * `stale` tells it when the snapshot itself is overdue for a refresh.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const snap = await ensureSnapshot();

  if (!snap.data) {
    return NextResponse.json(
      { error: snap.error?.message ?? 'Data not available yet.' },
      { status: snap.error?.status ?? 503 },
    );
  }

  const all = normalizeMatches(snap.data.matches ?? []);
  const live = all.filter((m) => m.phase === 'live' || m.phase === 'finished');

  return NextResponse.json(
    {
      matches: live,
      liveCount: live.filter((m) => m.phase === 'live').length,
      updatedAt: new Date(snap.fetchedAt).toISOString(),
      stale: snap.stale,
      delayedSource: true,
    },
    {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    },
  );
}
