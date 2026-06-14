import type { NormMatch, RawStage } from './football/types';

/**
 * Team lookup + search, ported from the legacy single-file app and adapted to
 * the normalized match shape. The index is keyed off lowercased team *name* for
 * search ergonomics, but each entry also carries the stable `id` for features
 * that need it (follow-a-team, push).
 */

export interface TeamEntry {
  key: string;
  id: number | null;
  name: string;
  tla: string;
  crest: string | null;
  group: string | null;
  matches: NormMatch[];
}

export type TeamIndex = Record<string, TeamEntry>;

// World Cup title holders — the only 8 nations ever to win. Not in the free API,
// so kept here for the "FIFA World Cup Titles" panel.
export const WC_WINNERS: Record<string, { titles: number; years: number[] }> = {
  brazil: { titles: 5, years: [1958, 1962, 1970, 1994, 2002] },
  germany: { titles: 4, years: [1954, 1974, 1990, 2014] },
  italy: { titles: 4, years: [1934, 1938, 1982, 2006] },
  argentina: { titles: 3, years: [1978, 1986, 2022] },
  france: { titles: 2, years: [1998, 2018] },
  uruguay: { titles: 2, years: [1930, 1950] },
  england: { titles: 1, years: [1966] },
  spain: { titles: 1, years: [2010] },
};

// Search aliases — nicknames and native-language names → canonical lowercased
// name as returned by football-data.org.
export const ALIASES: Record<string, string> = {
  usa: 'united states',
  us: 'united states',
  america: 'united states',
  'united states of america': 'united states',
  uk: 'england',
  holland: 'netherlands',
  dutch: 'netherlands',
  'the netherlands': 'netherlands',
  "cote d'ivoire": 'ivory coast',
  'cote divoire': 'ivory coast',
  'dr congo': 'dr congo',
  'democratic republic of congo': 'dr congo',
  drc: 'dr congo',
  zaire: 'dr congo',
  korea: 'south korea',
  'republic of korea': 'south korea',
  nz: 'new zealand',
  'all whites': 'new zealand',
  saudi: 'saudi arabia',
  ksa: 'saudi arabia',
  czech: 'czechia',
  'czech republic': 'czechia',
  'slovak republic': 'slovakia',
  rsa: 'south africa',
  'bafana bafana': 'south africa',
  deutschland: 'germany',
  espana: 'spain',
  'españa': 'spain',
  brasil: 'brazil',
  selecao: 'brazil',
  'les bleus': 'france',
  'la roja': 'spain',
  albiceleste: 'argentina',
  oranje: 'netherlands',
  azzurri: 'italy',
  'gli azzurri': 'italy',
  'squadra azzurra': 'italy',
  'three lions': 'england',
  mannschaft: 'germany',
  'die mannschaft': 'germany',
  'super eagles': 'nigeria',
  'black stars': 'ghana',
  'lions of atlas': 'morocco',
  'teranga lions': 'senegal',
  'indomitable lions': 'cameroon',
  elephants: 'ivory coast',
  'red devils': 'belgium',
  'samurai blue': 'japan',
  'taegeuk warriors': 'south korea',
  socceroos: 'australia',
  'all blacks': 'new zealand',
  persia: 'iran',
  celeste: 'uruguay',
  'la celeste': 'uruguay',
};

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: 'Group Stage',
  LAST_32: 'Round of 32',
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-Finals',
  SEMI_FINALS: 'Semi-Finals',
  THIRD_PLACE: 'Third Place',
  FINAL: 'Final',
};

export function stageLabel(stage: RawStage): string {
  return STAGE_LABELS[stage] ?? String(stage).replace(/_/g, ' ');
}

/** Build a name-keyed index from normalized matches, skipping TBD placeholders. */
export function buildTeamIndex(matches: NormMatch[]): TeamIndex {
  const idx: TeamIndex = {};
  for (const match of matches) {
    for (const side of [match.home, match.away]) {
      if (side.placeholder || !side.name) continue;
      const key = side.name.toLowerCase();
      if (!idx[key]) {
        idx[key] = {
          key,
          id: side.id,
          name: side.name,
          tla: side.tla,
          crest: side.crest,
          group: match.group,
          matches: [],
        };
      }
      idx[key].matches.push(match);
      if (match.group) idx[key].group = match.group;
    }
  }
  return idx;
}

export function resolveQuery(query: string): string {
  const q = query.trim().toLowerCase();
  return ALIASES[q] ?? q;
}

export function findTeam(
  index: TeamIndex,
  query: string,
): { key: string; team: TeamEntry } | null {
  const resolved = resolveQuery(query);
  if (!resolved) return null;
  if (index[resolved]) return { key: resolved, team: index[resolved] };

  const keys = Object.keys(index);
  const hit = keys.find((k) => k.startsWith(resolved) || resolved.startsWith(k));
  if (hit) return { key: hit, team: index[hit] };

  const sub = keys.find((k) => k.includes(resolved));
  if (sub) return { key: sub, team: index[sub] };

  return null;
}

export function getSuggestions(
  index: TeamIndex,
  query: string,
): Array<{ key: string; name: string; group: string | null }> {
  const q = resolveQuery(query);
  if (q.length < 2) return [];
  return Object.entries(index)
    .filter(([k]) => k.includes(q) || q.includes(k))
    .slice(0, 5)
    .map(([k, v]) => ({ key: k, name: v.name, group: v.group }));
}
