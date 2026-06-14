import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the homepage exists as a real route today. Per-team and per-date pages
// (the long-tail SEO win) will be appended here once those routes ship.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
  ];
}
