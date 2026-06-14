import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CopaKick 2026 Hub',
    short_name: 'CopaKick',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#f59e08',
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
