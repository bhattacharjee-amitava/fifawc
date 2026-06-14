"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Clock,
  ListTree,
  MapPin,
  RefreshCw,
  Search,
  Star,
  Trophy,
  X,
} from "lucide-react";
import { format } from "date-fns";
import type { NormMatch } from "@/lib/football/types";
import {
  buildTeamIndex,
  findTeam,
  getSuggestions,
  resolveQuery,
  stageLabel,
  WC_WINNERS,
  type TeamEntry,
  type TeamIndex,
} from "@/lib/teams";
import {
  kickoffDate,
  kickoffTimeShort,
  localClock,
  localDateKey,
  localTzAbbrev,
  relativeKickoff,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

const CACHE_MATCHES = "copakick_matches_v3";
const CACHE_TS = "copakick_ts_v3";
const CACHE_TTL = 3 * 60 * 1000;
const FOLLOW_KEY = "copakick_following_v1";

type Status = "loading" | "ready" | "error";

/** A followed team — self-contained so chips render without a live lookup.
 *  Anchored on the stable football-data `id` where available. */
interface Fav {
  id: number | null;
  key: string;
  name: string;
  crest: string | null;
}

/** Minimal team shape needed to follow/unfollow — a full NormTeam also fits. */
type FollowTarget = { id: number | null; name: string; crest: string | null };

function safeJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function safeSave(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

// ── Atoms ────────────────────────────────────────────────────────────────────

function Crest({
  url,
  alt,
  size = 24,
}: {
  url: string | null;
  alt: string;
  size?: number;
}) {
  if (!url) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-secondary text-[0.6em] text-muted-foreground"
        style={{ width: size, height: size }}
        aria-hidden
      >
        ?
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className="inline-block shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-live/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-live">
      <span className="live-dot inline-block size-1.5 rounded-full bg-live" />
      Live
    </span>
  );
}

// A ticking clock of the viewer's current local time + timezone. Mounts client
// side only (null on first render) to avoid hydration mismatch.
function LocalClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    // Minutes only — a 20s tick keeps the rollover lag small without churn.
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return null;
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
      <Clock className="size-3 shrink-0 text-primary/70" />
      <span>{localClock(now)}</span>
      <span className="text-muted-foreground/60">(YOUR LOCAL TIME)</span>
    </span>
  );
}

// One team line inside a fixture card. Score sits right; name gets the rest.
// A follow star sits between the two: always shown (filled) for a followed team,
// otherwise revealed on card hover as an outline button to follow from here.
function TeamRow({
  team,
  score,
  showScore,
  isLive,
  win,
  dim,
  highlight,
  isFollowed,
  onToggleFollow,
}: {
  team: NormMatch["home"];
  score: number | null;
  showScore: boolean;
  isLive: boolean;
  win: boolean;
  dim: boolean;
  highlight?: string;
  isFollowed?: boolean;
  onToggleFollow?: (team: NormMatch["home"]) => void;
}) {
  const isHi = highlight && team.name === highlight;
  const canFollow = !team.placeholder && !!onToggleFollow;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Crest url={team.crest} alt={team.name} size={26} />
        <span
          className={cn(
            "truncate font-display text-[15px] font-semibold leading-tight",
            dim ? "text-muted-foreground" : "text-foreground",
            isHi && "text-primary",
          )}
        >
          {team.name}
        </span>
        {canFollow && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFollow!(team);
            }}
            aria-label={
              isFollowed ? `Unfollow ${team.name}` : `Follow ${team.name}`
            }
            title={
              isFollowed ? "Following — click to unfollow" : "Follow this team"
            }
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-md transition",
              "hover:bg-secondary",
              isFollowed
                ? "text-primary"
                : "text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover:opacity-100 hover:text-foreground",
            )}
          >
            <Star className={cn("size-3.5", isFollowed && "fill-primary")} />
          </button>
        )}
      </div>
      {showScore && (
        <span
          className={cn(
            "shrink-0 font-mono text-lg font-bold tabular-nums",
            isLive
              ? "text-live"
              : win
                ? "text-foreground"
                : "text-muted-foreground",
          )}
        >
          {score ?? 0}
        </span>
      )}
    </div>
  );
}

// Vertical fixture card: header (group · time/status) over two stacked team rows.
function FixtureCard({
  match,
  highlight,
  index = 0,
  followedKeys,
  onToggleFollow,
}: {
  match: NormMatch;
  highlight?: string;
  index?: number;
  followedKeys?: Set<string>;
  onToggleFollow?: (team: NormMatch["home"]) => void;
}) {
  const { home, away, score, phase } = match;
  const showScore = phase === "finished" || phase === "live";
  const isLive = phase === "live";
  const winHome = phase === "finished" && score.winner === "HOME_TEAM";
  const winAway = phase === "finished" && score.winner === "AWAY_TEAM";
  const countdown =
    phase === "upcoming" ? relativeKickoff(match.kickoff) : null;
  const showFooter = !!countdown || isLive || !!match.venue;

  return (
    <article
      className="animate-rise group flex flex-col rounded-xl border border-border/80 bg-card/80 p-4 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="truncate pt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {match.group ?? stageLabel(match.stage)}
        </span>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isLive ? (
            <LiveBadge />
          ) : phase === "finished" ? (
            <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              FT
            </span>
          ) : (
            <span className="font-mono text-xs font-semibold tabular-nums text-primary">
              {kickoffTimeShort(match.kickoff)}
            </span>
          )}
          <span className="font-mono text-[10px] text-muted-foreground">
            {kickoffDate(match.kickoff)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <TeamRow
          team={home}
          score={score.home}
          showScore={showScore}
          isLive={isLive}
          win={winHome}
          dim={winAway}
          highlight={highlight}
          isFollowed={followedKeys?.has(home.name.toLowerCase())}
          onToggleFollow={onToggleFollow}
        />
        <TeamRow
          team={away}
          score={score.away}
          showScore={showScore}
          isLive={isLive}
          win={winAway}
          dim={winHome}
          highlight={highlight}
          isFollowed={followedKeys?.has(away.name.toLowerCase())}
          onToggleFollow={onToggleFollow}
        />
      </div>

      {showFooter && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
          {countdown ? (
            <span className="flex items-center gap-1 text-foreground/70">
              <Clock className="size-3 shrink-0 text-primary/70" />
              {countdown}
            </span>
          ) : isLive ? (
            <span className="flex items-center gap-1 font-medium text-live">
              <span className="live-dot inline-block size-1.5 rounded-full bg-live" />
              In progress
            </span>
          ) : (
            <span />
          )}
          {match.venue ? (
            <span className="flex min-w-0 items-center gap-1 truncate">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{match.venue}</span>
            </span>
          ) : (
            <span />
          )}
        </div>
      )}
    </article>
  );
}

// Compact list row for modals.
function FixtureRow({ match }: { match: NormMatch }) {
  let mid: React.ReactNode;
  if (match.phase === "finished") {
    mid = (
      <span className="font-mono font-bold tabular-nums text-foreground">
        {match.score.home ?? "?"}:{match.score.away ?? "?"}
      </span>
    );
  } else if (match.phase === "live") {
    mid = (
      <span className="font-mono font-bold tabular-nums text-live">
        {match.score.home ?? 0}:{match.score.away ?? 0}
      </span>
    );
  } else {
    mid = (
      <span className="whitespace-nowrap font-mono text-xs text-primary">
        {kickoffTimeShort(match.kickoff)}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2 border-b border-border/50 py-2.5 text-sm last:border-0">
      <span className="flex w-[42%] items-center justify-end gap-1.5 text-right">
        <span className="truncate font-display">{match.home.name}</span>
        <Crest url={match.home.crest} alt={match.home.name} size={18} />
      </span>
      <span className="w-[16%] text-center">{mid}</span>
      <span className="flex w-[42%] items-center gap-1.5 text-left">
        <Crest url={match.away.crest} alt={match.away.name} size={18} />
        <span className="truncate font-display">{match.away.name}</span>
      </span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function WorldCupHub() {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [matches, setMatches] = useState<NormMatch[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{
    key: string;
    team: TeamEntry;
  } | null>(null);
  const [champion, setChampion] = useState<string | null>(null);
  const [following, setFollowing] = useState<Fav[]>([]);
  const [tz, setTz] = useState("");
  const [allOpen, setAllOpen] = useState(false);
  const [dateISO, setDateISO] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const teamIndex: TeamIndex = useMemo(
    () => buildTeamIndex(matches),
    [matches],
  );

  const load = useCallback(async (force = false) => {
    setStatus("loading");
    try {
      if (!force) {
        const ts = Number(localStorage.getItem(CACHE_TS) ?? 0);
        if (Date.now() - ts < CACHE_TTL) {
          const cached = safeJSON<NormMatch[] | null>(CACHE_MATCHES, null);
          if (cached?.length) {
            setMatches(cached);
            setStatus("ready");
            return;
          }
        }
      }
      const res = await fetch(
        "/api/matches",
        force ? { cache: "no-store" } : {},
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      const data: { matches: NormMatch[] } = await res.json();
      setMatches(data.matches);
      safeSave(CACHE_MATCHES, data.matches);
      safeSave(CACHE_TS, Date.now());
      setErrorMsg("");
      setStatus("ready");
    } catch (err) {
      const cached = safeJSON<NormMatch[] | null>(CACHE_MATCHES, null);
      if (cached?.length) {
        setMatches(cached);
        setStatus("ready");
        setErrorMsg("Showing cached data — live refresh failed.");
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    setTz(localTzAbbrev());
    setFollowing(safeJSON<Fav[]>(FOLLOW_KEY, []));
    load();
  }, [load]);

  // Re-render every minute so the "in N hours" countdowns stay current.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const totals = useMemo(() => {
    const total = matches.length;
    const finished = matches.filter((m) => m.phase === "finished").length;
    const live = matches.filter((m) => m.phase === "live").length;
    return { total, finished, live };
  }, [matches]);

  const liveNow = useMemo(
    () => matches.filter((m) => m.phase === "live"),
    [matches],
  );
  const upNext = useMemo(
    () => matches.filter((m) => m.phase === "upcoming"),
    [matches],
  );
  const completed = useMemo(
    () =>
      matches
        .filter((m) => m.phase === "finished")
        .sort((a, b) => b.kickoff - a.kickoff),
    [matches],
  );
  const suggestions = useMemo(
    () => (showSuggestions ? getSuggestions(teamIndex, query) : []),
    [showSuggestions, teamIndex, query],
  );

  const openTeam = useCallback(
    (key: string) => {
      const team = teamIndex[key];
      if (!team) return;
      setQuery(team.name);
      setSelected({ key, team });
      setChampion(null);
      setShowSuggestions(false);
    },
    [teamIndex],
  );

  function onSearchChange(value: string) {
    setQuery(value);
    const hit = findTeam(teamIndex, value);
    if (hit) {
      setSelected(hit);
      setChampion(null);
      setShowSuggestions(false);
      return;
    }
    const q = resolveQuery(value);
    if (WC_WINNERS[q] && !teamIndex[q]) {
      setSelected(null);
      setChampion(q);
      setShowSuggestions(false);
      return;
    }
    setSelected(null);
    setChampion(null);
    setShowSuggestions(value.trim().length > 1);
  }

  function clearSearch() {
    setQuery("");
    setSelected(null);
    setChampion(null);
    setShowSuggestions(false);
  }

  const followedKeys = useMemo(
    () => new Set(following.map((f) => f.key)),
    [following],
  );

  // Toggle follow for any team identified by name (the follow key). Used by both
  // the team panel button and the inline star on every fixture card.
  const toggleFollowTeam = useCallback(
    (team: { id: number | null; name: string; crest: string | null }) => {
      const key = team.name.toLowerCase();
      setFollowing((prev) => {
        const exists = prev.some((f) => f.key === key);
        const next = exists
          ? prev.filter((f) => f.key !== key)
          : [...prev, { id: team.id, key, name: team.name, crest: team.crest }];
        safeSave(FOLLOW_KEY, next);
        return next;
      });
    },
    [],
  );

  function toggleFollow() {
    if (!selected) return;
    toggleFollowTeam(selected.team);
  }

  const showHero = !selected && !champion && query.trim() === "";
  const isFollowing = selected
    ? following.some((f) => f.key === selected.key)
    : false;

  return (
    <div className="relative z-10">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={clearSearch}
            className="group flex items-center gap-2 text-left"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/android-chrome-192x192.png"
              alt="CopaKick"
              width={28}
              height={28}
              className="size-5 shrink-0 rounded-lg object-contain sm:size-7"
            />
            <span className="font-display text-sm font-extrabold uppercase leading-none tracking-tight sm:text-lg">
              Copa<span className="text-primary">kick</span>
            </span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <LocalClock />
            {totals.live > 0 && (
              <span className="hidden items-center gap-1.5 rounded-md bg-live/15 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-live sm:inline-flex">
                <span className="live-dot inline-block size-1.5 rounded-full bg-live" />
                {totals.live} live
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => load(true)}
              title="Refresh fixtures"
              className="text-muted-foreground hover:text-primary"
            >
              <RefreshCw
                className={cn(status === "loading" && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        {/* Hero (empty state only) + controls (always) */}
        <section className={cn(showHero ? "pt-8 sm:pt-12" : "pt-5")}>
          {showHero && (
            <div className="mb-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary/80">
                11 Jun – 19 Jul 2026 · USA · Canada · Mexico
              </p>
              <h1 className="mt-2 font-display text-4xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
                The World Cup,
                <br />
                <span className="text-primary">on your clock.</span>
              </h1>
              <p className="mt-3 max-w-md text-sm text-muted-foreground">
                Every fixture in your local timezone. Official data; scores may
                lag a touch.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div ref={searchWrapRef} className="relative flex-1">
              <Input
                value={query}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() =>
                  query.trim().length > 1 &&
                  !selected &&
                  setShowSuggestions(true)
                }
                placeholder="Search for a team"
                className="h-12 rounded-xl border-border bg-card/70 pl-10 pr-10 text-base shadow-inner backdrop-blur-sm focus-visible:border-primary"
              />
              {/* Icon rendered AFTER the input so it paints above the input's
                  backdrop-blur stacking context (same trick as the clear button). */}
              <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
              {query && (
                <button
                  onClick={clearSearch}
                  aria-label="Clear"
                  className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
              {suggestions.length > 0 && (
                <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover/95 shadow-2xl backdrop-blur-md">
                  {suggestions.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => openTeam(s.key)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-secondary"
                    >
                      <span className="font-display font-medium">{s.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {s.group ?? ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={() => setDateISO("PICK")}
                className="h-12 flex-1 rounded-xl border-border bg-card/70 backdrop-blur-sm hover:border-primary/50 hover:text-primary sm:flex-none"
              >
                <CalendarDays /> By date
              </Button>
              <Button
                variant="outline"
                onClick={() => setAllOpen(true)}
                className="h-12 flex-1 rounded-xl border-border bg-card/70 backdrop-blur-sm hover:border-primary/50 hover:text-primary sm:flex-none"
              >
                <ListTree /> All fixtures
              </Button>
            </div>
          </div>

          {errorMsg && status !== "error" && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              {errorMsg}
            </p>
          )}
        </section>

        {/* Content */}
        <section className="mt-8">
          {status === "loading" && <LoadingGrid />}

          {status === "error" && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive-foreground">
              <p className="font-semibold">⚠ {errorMsg}</p>
              <p className="mt-1 text-xs opacity-80">
                Tap refresh in the header to retry.
              </p>
            </div>
          )}

          {status === "ready" && selected && (
            <TeamPanel
              team={selected.team}
              isFollowing={isFollowing}
              onToggleFollow={toggleFollow}
              followedKeys={followedKeys}
              onToggleFollowTeam={toggleFollowTeam}
            />
          )}

          {status === "ready" && !selected && champion && (
            <ChampionNote name={champion} />
          )}

          {status === "ready" && !selected && !champion && (
            <DefaultFeed
              following={following}
              live={liveNow}
              upcoming={upNext}
              completed={completed}
              onPick={openTeam}
              followedKeys={followedKeys}
              onToggleFollowTeam={toggleFollowTeam}
            />
          )}
        </section>
      </main>

      {/* Modals */}
      <AllFixturesDialog
        open={allOpen}
        onOpenChange={setAllOpen}
        matches={matches}
        tz={tz}
      />
      <DateDialog
        value={dateISO}
        onChange={setDateISO}
        matches={matches}
        tz={tz}
      />
    </div>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────────

function SectionHeading({
  icon,
  label,
  accent,
  count,
}: {
  icon?: React.ReactNode;
  label: string;
  accent?: string;
  count?: number;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {icon}
      <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
        {count != null && (
          <span className="ml-1.5 text-muted-foreground/60">({count})</span>
        )}
      </h2>
      {accent && (
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {accent}
        </span>
      )}
      <span className="ml-1 h-px flex-1 bg-border" />
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

// A single Following pill. Its width is locked to the natural (no-cross) size on
// mount, so the cross button can overlay absolutely on hover and push the name to
// truncate — without the cross ever taking space or the pill shifting layout.
function FollowPill({
  fav,
  onPick,
  onUnfollow,
}: {
  fav: Fav;
  onPick: (key: string) => void;
  onUnfollow: (key: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.width = ""; // remeasure cleanly if the name ever changes
    // Round up the fractional content width — flooring (offsetWidth) leaves it a
    // sub-pixel short, which would truncate the name even at rest.
    el.style.width = `${Math.ceil(el.getBoundingClientRect().width)}px`;
  }, [fav.name]);

  return (
    <div
      ref={ref}
      className="group relative flex shrink-0 items-center rounded-md border border-border bg-card/70 backdrop-blur-sm transition hover:border-primary/50 hover:bg-card"
    >
      <button
        onClick={() => onPick(fav.key)}
        className="flex w-full min-w-0 items-center gap-2 py-1.5 pl-1.5 pr-3.5 transition-[padding] group-hover:pr-9 [@media(hover:none)]:pr-9"
      >
        <Crest url={fav.crest} alt={fav.name} size={24} />
        <span className="truncate font-display text-sm font-medium">
          {fav.name}
        </span>
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onUnfollow(fav.key)}
            aria-label={`Unfollow ${fav.name}`}
            className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Unfollow {fav.name}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function FollowingRow({
  following,
  onPick,
  onUnfollow,
}: {
  following: Fav[];
  onPick: (key: string) => void;
  onUnfollow: (key: string) => void;
}) {
  if (following.length === 0) return null;
  return (
    <div>
      <SectionHeading
        icon={<Star className="size-3.5 fill-primary text-primary" />}
        label="Following"
        count={following.length}
      />
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
        {following.map((f) => (
          <FollowPill
            key={f.key}
            fav={f}
            onPick={onPick}
            onUnfollow={onUnfollow}
          />
        ))}
      </div>
    </div>
  );
}

function DefaultFeed({
  following,
  live,
  upcoming,
  completed,
  onPick,
  followedKeys,
  onToggleFollowTeam,
}: {
  following: Fav[];
  live: NormMatch[];
  upcoming: NormMatch[];
  completed: NormMatch[];
  onPick: (key: string) => void;
  followedKeys: Set<string>;
  onToggleFollowTeam: (team: FollowTarget) => void;
}) {
  const [tab, setTab] = useState<"upcoming" | "completed">("upcoming");
  const list = tab === "upcoming" ? upcoming : completed;

  return (
    <div className="space-y-10">
      <FollowingRow
        following={following}
        onPick={onPick}
        onUnfollow={(key) => {
          const f = following.find((x) => x.key === key);
          if (f) onToggleFollowTeam({ id: f.id, name: f.name, crest: f.crest });
        }}
      />

      {live.length > 0 && (
        <div>
          <SectionHeading
            icon={
              <span className="live-dot inline-block size-2 rounded-full bg-live" />
            }
            label="Live now"
          />
          <Grid>
            {live.map((m, i) => (
              <FixtureCard
                key={m.id}
                match={m}
                index={i}
                followedKeys={followedKeys}
                onToggleFollow={onToggleFollowTeam}
              />
            ))}
          </Grid>
        </div>
      )}

      <div>
        <div className="mb-4 flex items-center gap-3">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "upcoming" | "completed")}
          >
            <TabsList variant="line" className="gap-4 p-0">
              <TabsTrigger
                value="upcoming"
                className="px-0 font-mono text-xs font-semibold uppercase tracking-[0.2em]"
              >
                Next up
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="px-0 font-mono text-xs font-semibold uppercase tracking-[0.2em]"
              >
                Completed ({completed.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {list.length ? (
          <Grid>
            {list.map((m, i) => (
              <FixtureCard
                key={m.id}
                match={m}
                index={i}
                followedKeys={followedKeys}
                onToggleFollow={onToggleFollowTeam}
              />
            ))}
          </Grid>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            {tab === "upcoming"
              ? "No upcoming fixtures."
              : "No completed matches yet."}
          </p>
        )}
      </div>
    </div>
  );
}

function TeamPanel({
  team,
  isFollowing,
  onToggleFollow,
  followedKeys,
  onToggleFollowTeam,
}: {
  team: TeamEntry;
  isFollowing: boolean;
  onToggleFollow: () => void;
  followedKeys: Set<string>;
  onToggleFollowTeam: (team: FollowTarget) => void;
}) {
  const sorted = useMemo(
    () => [...team.matches].sort((a, b) => a.kickoff - b.kickoff),
    [team.matches],
  );
  const winner = WC_WINNERS[team.key];

  return (
    <div className="space-y-8">
      {/* Team hero */}
      <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Crest url={team.crest} alt={team.name} size={56} />
            <div>
              <h1 className="font-display text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">
                {team.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {team.group && (
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    {team.group}
                  </Badge>
                )}
                {winner && (
                  <Badge className="bg-primary/15 font-mono text-[11px] text-primary hover:bg-primary/15">
                    {winner.titles}× champion
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            variant={isFollowing ? "secondary" : "outline"}
            size="sm"
            onClick={onToggleFollow}
            className={cn(
              "shrink-0 gap-1.5 rounded-md",
              isFollowing && "border-primary/30 text-primary",
            )}
          >
            <Star
              className={cn(
                "size-4",
                isFollowing && "fill-primary text-primary",
              )}
            />
            {isFollowing ? "Following" : "Follow"}
          </Button>
        </div>
      </div>

      {/* Fixtures */}
      <div>
        <SectionHeading
          icon={<CalendarDays className="size-4 text-primary" />}
          label="Fixtures"
        />
        {sorted.length ? (
          <Grid>
            {sorted.map((m, i) => (
              <FixtureCard
                key={m.id}
                match={m}
                highlight={team.name}
                index={i}
                followedKeys={followedKeys}
                onToggleFollow={onToggleFollowTeam}
              />
            ))}
          </Grid>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No fixtures found.
          </p>
        )}
      </div>

      {/* Honours */}
      <div>
        <SectionHeading
          icon={<Trophy className="size-4 text-primary" />}
          label="World Cup titles"
        />
        <div className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur-sm">
          {winner ? (
            <div className="flex items-center gap-4">
              <span className="font-mono text-3xl font-bold tabular-nums text-primary">
                {winner.titles}
              </span>
              <div>
                <p className="font-display text-sm font-semibold">
                  {winner.titles === 1
                    ? "World Champion"
                    : `${winner.titles}× World Champion`}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {winner.years.join(" · ")}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No World Cup title yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChampionNote({ name }: { name: string }) {
  const w = WC_WINNERS[name];
  const pretty = name.replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card/60 p-6 text-center backdrop-blur-sm">
      <Trophy className="mx-auto size-8 text-primary" />
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">
        {pretty}
      </h1>
      <Badge variant="secondary" className="mt-2 font-mono text-[11px]">
        Not in WC 2026
      </Badge>
      <p className="mt-4 font-mono text-2xl font-bold text-primary">
        {w.titles}× champion
      </p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {w.years.join(" · ")}
      </p>
      <p className="mt-4 text-xs italic text-muted-foreground">
        {pretty} did not qualify for the 2026 tournament.
      </p>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-37 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ── Dialogs ──────────────────────────────────────────────────────────────────

function groupMatches(matches: NormMatch[]): Array<[string, NormMatch[]]> {
  const groups: Record<string, NormMatch[]> = {};
  for (const m of matches) {
    const label = m.group ?? stageLabel(m.stage);
    (groups[label] ??= []).push(m);
  }
  const order = (key: string): number => {
    const letter = key.match(/Group ([A-L])/i);
    if (letter) return letter[1].toUpperCase().charCodeAt(0);
    const ko: Record<string, number> = {
      "Round of 32": 200,
      "Round of 16": 201,
      "Quarter-Finals": 202,
      "Semi-Finals": 203,
      "Third Place": 204,
      Final: 205,
    };
    return ko[key] ?? 300;
  };
  return Object.entries(groups)
    .sort(([a], [b]) => order(a) - order(b))
    .map(
      ([k, list]) =>
        [k, list.sort((x, y) => x.kickoff - y.kickoff)] as [
          string,
          NormMatch[],
        ],
    );
}

function AllFixturesDialog({
  open,
  onOpenChange,
  matches,
  tz,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  matches: NormMatch[];
  tz: string;
}) {
  const grouped = useMemo(() => groupMatches(matches), [matches]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="font-display text-base">
            All 2026 fixtures
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px]">
            Groups A–L · knockouts · times in {tz}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {grouped.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No fixtures yet.
            </p>
          ) : (
            grouped.map(([label, list]) => (
              <div key={label} className="mb-5">
                <h3 className="mb-1.5 font-mono text-xs font-bold uppercase tracking-widest text-primary">
                  {label}
                </h3>
                {list.map((m) => (
                  <FixtureRow key={m.id} match={m} />
                ))}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DateDialog({
  value,
  onChange,
  matches,
  tz,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  matches: NormMatch[];
  tz: string;
}) {
  const open = value !== null;

  // Tournament window (ISO yyyy-mm-dd). Year is always 2026.
  const TOURNAMENT_START = "2026-06-11";
  const TOURNAMENT_END = "2026-07-19";
  const windowStart = new Date(TOURNAMENT_START + "T12:00:00");
  const windowEnd = new Date(TOURNAMENT_END + "T12:00:00");

  // The currently selected day (ISO). Always set while the dialog is open so a
  // date is always visible and its fixtures render beneath the picker.
  const [selected, setSelected] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setPickerOpen(false);
      return;
    }
    // Seed from the incoming value if it's a real in-window date, otherwise
    // default to tomorrow (clamped into the tournament window).
    if (value && value !== "PICK" && value >= TOURNAMENT_START && value <= TOURNAMENT_END) {
      setSelected(value);
      return;
    }
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const clamped = new Date(
      Math.min(Math.max(t.getTime(), windowStart.getTime()), windowEnd.getTime()),
    );
    setSelected(
      `2026-${String(clamped.getMonth() + 1).padStart(2, "0")}-${String(clamped.getDate()).padStart(2, "0")}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onDate = useMemo(() => {
    if (!selected) return [];
    return matches
      .filter((m) => localDateKey(m.kickoff) === selected)
      .sort((a, b) => a.kickoff - b.kickoff);
  }, [matches, selected]);

  const selectedDate = selected ? new Date(selected + "T12:00:00") : undefined;
  const isMobile = useIsMobile();

  // Shared body: the persistent date trigger + the selected day's fixtures.
  const body = (
    <>
      <div className="flex shrink-0 flex-col gap-1 border-b border-border px-5 py-4">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between font-normal"
            >
              {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
              <ChevronDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                if (!d) return;
                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                // Backstop: the disabled matcher already blocks out-of-window
                // days in the UI; guard keyboard entry too.
                if (iso < TOURNAMENT_START || iso > TOURNAMENT_END) return;
                setSelected(iso);
                setPickerOpen(false);
              }}
              defaultMonth={selectedDate ?? windowStart}
              startMonth={windowStart}
              endMonth={windowEnd}
              disabled={{ before: windowStart, after: windowEnd }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {onDate.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No matches on this day.
          </p>
        ) : (
          onDate.map((m) => <FixtureRow key={m.id} match={m} />)
        )}
      </div>
    </>
  );

  // Bottom sheet on phones, centred dialog on larger screens.
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onChange(null)}>
        <SheetContent
          side="bottom"
          className="flex max-h-[88vh] flex-col gap-0 rounded-t-2xl p-0"
        >
          <SheetHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
            <SheetTitle className="font-display text-base">
              Fixtures by date
            </SheetTitle>
            <SheetDescription className="font-mono text-[11px]">
              Kick-off times in {tz}
            </SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onChange(null)}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="font-display text-base">
            Fixtures by date
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px]">
            Kick-off times in {tz}
          </DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
