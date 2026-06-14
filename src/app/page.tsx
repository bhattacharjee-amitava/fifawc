import WorldCupHub from "@/components/WorldCupHub";
import { getWorldCupMatches } from "@/lib/football/client";
import { normalizeMatches } from "@/lib/football/normalize";
import type { NormMatch } from "@/lib/football/types";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Match data + bracket structure change slowly; revalidate hourly so the
// server-rendered structured data stays fresh without hammering upstream.
export const revalidate = 3600;

// The hub is fully interactive (search, modals, favorites, localStorage) and
// fetches `/api/matches` on mount, so it owns the client runtime end-to-end.
// Here we *additionally* fetch the schedule server-side purely to emit JSON-LD
// structured data into the initial HTML — this is what lets search engines see
// every fixture and kickoff time without executing the app. It never affects
// what the user sees, and failures are swallowed so SEO is best-effort only.
export default async function Home() {
  let matches: NormMatch[] = [];
  try {
    const raw = await getWorldCupMatches(revalidate);
    matches = normalizeMatches(raw.matches ?? []);
  } catch {
    // Structured data is best-effort; the client hub renders regardless.
  }

  return (
    <>
      <StructuredData matches={matches} />
      <WorldCupHub />
    </>
  );
}

function StructuredData({ matches }: { matches: NormMatch[] }) {
  const tournament = {
    "@type": "SportsEvent",
    name: "FIFA World Cup 2026",
    sport: "Soccer",
    startDate: "2026-06-11",
    endDate: "2026-07-19",
    url: SITE_URL,
    location: [
      { "@type": "Country", name: "United States" },
      { "@type": "Country", name: "Canada" },
      { "@type": "Country", name: "Mexico" },
    ],
  };

  // One SportsEvent per fixture with both teams resolved (skip bracket
  // placeholders like "Winner Group A"). Kickoff is the UTC ISO instant.
  const events = matches
    .filter((m) => !m.home.placeholder && !m.away.placeholder)
    .map((m) => ({
      "@type": "SportsEvent",
      name: `${m.home.name} vs ${m.away.name}`,
      sport: "Soccer",
      startDate: m.utcDate,
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      ...(m.venue ? { location: { "@type": "Place", name: m.venue } } : {}),
      competitor: [
        { "@type": "SportsTeam", name: m.home.name },
        { "@type": "SportsTeam", name: m.away.name },
      ],
      superEvent: { "@type": "SportsEvent", name: "FIFA World Cup 2026" },
      url: SITE_URL,
    }));

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        description:
          "FIFA World Cup 2026 fixtures and kickoff times in your local timezone.",
      },
      tournament,
      ...events,
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Numeric/string data only — no user input — so this is safe to inline.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
