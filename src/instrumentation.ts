/**
 * Runs once when the server process boots (Next.js instrumentation).
 *
 * We start the football-data refresh loop here so the in-process snapshot is the
 * *only* thing talking to upstream — fetched on a fixed cadence rather than per
 * request. Node runtime only (skip Edge), and the loop self-guards against double
 * starts, so this is safe under HMR in dev too.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startRefreshLoop } = await import('@/lib/football/store');
  startRefreshLoop();
}
