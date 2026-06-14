import { NextResponse } from 'next/server';
import { FootballDataError, getWorldCupMatches } from '@/lib/football/client';
import { normalizeMatches } from '@/lib/football/normalize';

/**
 * Schedule endpoint: the full tournament, normalized and chronologically sorted.
 *
 * Kickoff times and bracket structure change slowly, so we cache hard (1h at the
 * data layer + shared CDN cache). This is the feed that drives the fixture list,
 * countdowns, and — later — push reminders.
 */

export const revalidate = 3600; // 1 hour

export async function GET() {
  try {
    const raw = await getWorldCupMatches(revalidate);
    const matches = normalizeMatches(raw.matches ?? []);

    return NextResponse.json(
      { matches, count: matches.length, updatedAt: new Date().toISOString() },
      {
        headers: {
          // Shared CDN cache: serve cached for 1h, refresh in background for 5m.
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=300',
        },
      },
    );
  } catch (err) {
    const status = err instanceof FootballDataError ? err.status : 500;
    const error = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error }, { status });
  }
}
