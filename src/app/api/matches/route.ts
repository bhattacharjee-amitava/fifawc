import { NextResponse } from 'next/server';
import { ensureSnapshot } from '@/lib/football/store';
import { normalizeMatches } from '@/lib/football/normalize';

/**
 * Schedule endpoint: the full tournament, normalized and chronologically sorted.
 *
 * This route only ever *reads* the in-process snapshot (see lib/football/store) —
 * it never calls upstream. The snapshot is refreshed on a fixed background cadence,
 * so device count and refresh-spam can't affect our upstream request rate.
 */

// Always run the handler so it reflects current in-memory snapshot state.
export const dynamic = 'force-dynamic';

export async function GET() {
  const snap = await ensureSnapshot();

  if (!snap.data) {
    // Cold start and upstream is failing — nothing to serve yet.
    return NextResponse.json(
      { error: snap.error?.message ?? 'Data not available yet.' },
      { status: snap.error?.status ?? 503 },
    );
  }

  const matches = normalizeMatches(snap.data.matches ?? []);

  return NextResponse.json(
    {
      matches,
      count: matches.length,
      updatedAt: new Date(snap.fetchedAt).toISOString(),
      stale: snap.stale,
    },
    {
      // Harmless on a bare droplet; lets a reverse proxy/CDN coalesce bursts if added.
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    },
  );
}
