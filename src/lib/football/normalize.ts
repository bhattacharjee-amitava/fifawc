import type {
  MatchPhase,
  NormMatch,
  NormTeam,
  RawMatch,
  RawMatchStatus,
  RawTeam,
} from './types';

/** Map upstream status onto the coarse phase the UI reasons about. */
export function phaseFromStatus(status: RawMatchStatus): MatchPhase {
  switch (status) {
    case 'SCHEDULED':
    case 'TIMED':
      return 'upcoming';
    case 'IN_PLAY':
    case 'PAUSED':
      return 'live';
    case 'FINISHED':
    case 'AWARDED':
      return 'finished';
    default:
      // SUSPENDED | POSTPONED | CANCELLED
      return 'other';
  }
}

/** "GROUP_A" -> "Group A"; null stays null (knockouts). */
export function prettyGroup(group: string | null): string | null {
  if (!group) return null;
  return group
    .replace('GROUP_', 'Group ')
    .replace(/_/g, ' ');
}

/**
 * Normalize a raw team. During knockout rounds the slot may be unresolved —
 * football-data sends null id/name. We surface that as `placeholder: true` and
 * synthesize a readable label so the UI never shows "null".
 */
function normalizeTeam(raw: RawTeam | undefined, fallbackLabel: string): NormTeam {
  const hasTeam = !!(raw && raw.id != null && raw.name);
  return {
    id: hasTeam ? raw!.id : null,
    name: hasTeam ? raw!.name! : fallbackLabel,
    tla: (raw?.tla ?? '').toUpperCase(),
    crest: raw?.crest ?? null,
    placeholder: !hasTeam,
  };
}

/**
 * Longest a match can plausibly stay "in play" end-to-end: 2×45 + halftime +
 * generous stoppage, then extra time + the penalty shootout. ~3h is a safe ceiling.
 */
const MAX_LIVE_MS = 3 * 60 * 60 * 1000;

export function normalizeMatch(raw: RawMatch, now = Date.now()): NormMatch {
  const parsed = Date.parse(raw.utcDate);
  const kickoff = Number.isNaN(parsed) ? 0 : parsed;

  let phase = phaseFromStatus(raw.status);
  // Free-tier upstream sometimes leaves a finished match stuck at IN_PLAY/PAUSED
  // (status lags long after the final whistle). If it's been "live" far longer
  // than any real match could run, trust the clock over the stale status.
  if (phase === 'live' && kickoff > 0 && now - kickoff > MAX_LIVE_MS) {
    phase = 'finished';
  }

  return {
    id: raw.id,
    kickoff,
    utcDate: raw.utcDate,
    phase,
    rawStatus: raw.status,
    stage: raw.stage,
    group: prettyGroup(raw.group),
    home: normalizeTeam(raw.homeTeam, 'TBD'),
    away: normalizeTeam(raw.awayTeam, 'TBD'),
    score: {
      home: raw.score?.fullTime?.home ?? null,
      away: raw.score?.fullTime?.away ?? null,
      winner: raw.score?.winner ?? null,
    },
    venue: raw.venue ?? null,
    lastUpdated: raw.lastUpdated,
  };
}

/** Normalize + sort chronologically by kickoff. */
export function normalizeMatches(raw: RawMatch[]): NormMatch[] {
  const now = Date.now();
  return raw
    .map((m) => normalizeMatch(m, now))
    .sort((a, b) => a.kickoff - b.kickoff);
}
