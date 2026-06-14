import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Hanken_Grotesk, Geist_Mono } from 'next/font/google';
import './globals.css';

// Display — characterful grotesque for the wordmark, team names, headlines.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
});

// Body / UI — warm, highly readable.
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
});

// Mono — scores, kickoff times, group codes (broadcast-data precision).
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CopaKick · World Cup 2026',
  description:
    'FIFA World Cup 2026 — search a country, browse fixtures, filter by date. Times in your local timezone.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0b09',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${hanken.variable} ${geistMono.variable}`}
    >
      <body className="relative min-h-screen">{children}</body>
    </html>
  );
}
