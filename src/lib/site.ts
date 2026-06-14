/**
 * Canonical site identity used for SEO (metadata, canonical URLs, sitemap,
 * robots, structured data). Set NEXT_PUBLIC_SITE_URL in production; on Vercel
 * the project URL is picked up automatically. The literal fallback is a
 * placeholder — change it (or set the env var) to your real domain.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://2026fifawc.vercel.app")
).replace(/\/$/, "");

export const SITE_NAME = "CopaKick";

export const SITE_TAGLINE =
  "FIFA World Cup 2026 fixtures and kickoff times in your local timezone.";
