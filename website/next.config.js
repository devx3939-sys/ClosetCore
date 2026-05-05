/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  // Allow tsconfig paths to resolve files outside the website directory.
  experimental: {
    externalDir: true,
  },
};

module.exports = nextConfig;
