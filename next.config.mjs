/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // GIFs/thumbs vêm do dataset (GitHub raw) ou do Supabase Storage
    remotePatterns: [
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
};

export default nextConfig;
