import 'server-only';
import { FootballDataError, getWorldCupMatches } from './client';
import type { RawMatchesResponse } from './types';

/**
 * In-process snapshot store — the single source of upstream data for the app.
 *
 * On our single-process deployment, module state is shared across every request,
 * so this *is* the shared cache: one variable holds the latest football-data
 * payload, and one background loop refreshes it. Route handlers only ever read
 * `getSnapshot()` / `ensureSnapshot()` — they never touch upstream — so the rate
 * of upstream calls is fixed by this module, not by how many devices connect or
 * how often they refresh. That's what keeps us inside the free tier (10 req/min).
 *
 * IMPORTANT: this guarantee holds *only while we run a single process*. If we ever
 * scale to PM2 cluster mode or multiple replicas, each process would keep its own
 * copy and the cap would multiply — at that point this must move to a shared store
 * (e.g. Redis) with a cross-process lock.
 */

/** Data older than this is "stale"; a read will kick a background refresh. */
const STALE_MS = 60_000;
/**
 * Hard floor between upstream calls. Combined with single-flight, this caps us at
 * ~3 req/min worst case (loop + on-read retries), comfortably under the 10/min limit.
 */
const MIN_INTERVAL_MS = 20_000;

export interface Snapshot {
  data: RawMatchesResponse | null;
  /** Epoch ms of the last *successful* fetch (0 = never succeeded). */
  fetchedAt: number;
  /** now - fetchedAt (Infinity before the first success). */
  ageMs: number;
  stale: boolean;
  /** Last upstream failure, if any. We keep serving `data` through errors. */
  error: { message: string; status: number; at: number } | null;
}

let data: RawMatchesResponse | null = null;
let fetchedAt = 0;
let lastError: Snapshot['error'] = null;
let lastAttempt = 0;
let inFlight: Promise<void> | null = null;
let loopStarted = false;

async function doFetch(): Promise<void> {
  lastAttempt = Date.now();
  try {
    // revalidate:0 — *this store* is the cache; don't layer Next's data cache on top.
    const raw = await getWorldCupMatches(0);
    data = raw;
    fetchedAt = Date.now();
    lastError = null;
  } catch (err) {
    lastError = {
      message: err instanceof Error ? err.message : 'Unknown error',
      status: err instanceof FootballDataError ? err.status : 502,
      at: Date.now(),
    };
    // Deliberately keep the last good `data`: stale-but-serving beats a broken UI.
  }
}

/**
 * Trigger a refresh. Concurrent callers coalesce into one upstream request
 * (single-flight), and we never call upstream more often than MIN_INTERVAL_MS
 * unless `force`d (only the background loop forces, on its fixed cadence).
 */
export function refresh(force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && Date.now() - lastAttempt < MIN_INTERVAL_MS) {
    return Promise.resolve();
  }
  inFlight = doFetch().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function snapshot(): Snapshot {
  const ageMs = fetchedAt ? Date.now() - fetchedAt : Infinity;
  return { data, fetchedAt, ageMs, stale: ageMs > STALE_MS, error: lastError };
}

/**
 * Read the current snapshot. If it's stale, kick a non-blocking refresh so the
 * *next* read is fresh — the caller still gets served immediately from memory.
 */
export function getSnapshot(): Snapshot {
  const snap = snapshot();
  if (snap.stale) void refresh();
  return snap;
}

/**
 * Like getSnapshot, but on a cold start (no data yet) it awaits the first fetch
 * so the response isn't empty. Used by the read routes.
 */
export async function ensureSnapshot(): Promise<Snapshot> {
  if (!data) {
    await refresh(true);
    return snapshot();
  }
  return getSnapshot();
}

/**
 * Start the background refresh loop. Called once at server boot from
 * instrumentation. Primes the snapshot immediately, then refreshes on a fixed
 * cadence so data stays warm even with zero traffic.
 */
export function startRefreshLoop(): void {
  if (loopStarted) return;
  loopStarted = true;
  void refresh(true);
  const timer = setInterval(() => void refresh(true), STALE_MS);
  // Don't let the loop keep the process alive on its own / block shutdown.
  timer.unref?.();
}
