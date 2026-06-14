/**
 * Types for the football-data.org v4 `/competitions/WC/matches` payload,
 * plus our own normalized shapes.
 *
 * We deliberately model the *raw* upstream loosely (fields can be null during
 * knockout placeholders) and expose a *clean* normalized type to the app.
 */

// ── Raw upstream (football-data.org v4) ──────────────────────────────────────

export type RawMatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'SUSPENDED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'AWARDED';

export type RawStage =
  | 'GROUP_STAGE'
  | 'LAST_16'
  | 'QUARTER_FINALS'
  | 'SEMI_FINALS'
  | 'THIRD_PLACE'
  | 'FINAL'
  // 2026 introduces a 32-team knockout round; keep it forward-compatible.
  | 'LAST_32'
  | (string & {});

export interface RawTeam {
  id: number | null;
  name: string | null;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
}

export interface RawScore {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT' | string;
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
}

export interface RawMatch {
  id: number;
  utcDate: string; // ISO 8601, UTC
  status: RawMatchStatus;
  stage: RawStage;
  group: string | null; // "GROUP_A" | null
  lastUpdated: string;
  homeTeam: RawTeam;
  awayTeam: RawTeam;
  score: RawScore;
  venue?: string | null;
  matchday?: number | null;
}

export interface RawMatchesResponse {
  competition?: unknown;
  filters?: unknown;
  resultSet?: { count: number; first?: string; last?: string };
  matches: RawMatch[];
}

// ── Normalized (what the app consumes) ───────────────────────────────────────

/** Coarse lifecycle bucket the UI cares about, derived from RawMatchStatus. */
export type MatchPhase = 'upcoming' | 'live' | 'finished' | 'other';

export interface NormTeam {
  /** Stable football-data id, or null when this is still a bracket placeholder. */
  id: number | null;
  /** Display name, or a placeholder like "Winner Group A" when unresolved. */
  name: string;
  tla: string;
  crest: string | null;
  /** True when the team slot is not yet decided (knockout placeholder). */
  placeholder: boolean;
}

export interface NormMatch {
  id: number;
  /** Epoch millis of kickoff (UTC) — the linchpin for countdowns/reminders. */
  kickoff: number;
  utcDate: string;
  phase: MatchPhase;
  rawStatus: RawMatchStatus;
  stage: RawStage;
  /** "Group A" | null */
  group: string | null;
  home: NormTeam;
  away: NormTeam;
  score: {
    home: number | null;
    away: number | null;
    winner: RawScore['winner'];
  };
  venue: string | null;
  lastUpdated: string;
}
