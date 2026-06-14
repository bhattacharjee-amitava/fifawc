/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // football-data.org team crests
      { protocol: 'https', hostname: 'crests.football-data.org' },
    ],
  },
};

export default nextConfig;
