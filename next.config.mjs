/**
 * Upstream da API (chamada servidor→servidor pelo proxy do Next).
 * Em produção vem de NEXT_PUBLIC_API_URL (ex: https://api.seudominio.com/api);
 * local cai no backend do Docker. API_UPSTREAM permite sobrescrever sem tocar na outra.
 */
const API_UPSTREAM = (
  process.env.API_UPSTREAM?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  'http://localhost:3000/api'
).replace(/\/+$/, '');

const isDev = process.env.NODE_ENV !== 'production';

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://raw.githubusercontent.com https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false, // não expõe "X-Powered-By: Next.js"
  images: {
    // GIFs/thumbs vêm do dataset (GitHub raw) ou do Supabase Storage
    remotePatterns: [
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  /**
   * Proxy da API: o navegador só fala com o domínio do app (/api/*) e o Next repassa
   * pro backend. Com isso o cookie httpOnly de sessão (JWT) é FIRST-PARTY — funciona em
   * todo navegador, inclusive iOS/Safari, que bloqueia cookie de terceiro (front na Vercel
   * e back na VPS em domínios diferentes). Sem isso, toda rota protegida dava 401 no celular.
   */
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_UPSTREAM}/:path*` }];
  },
};

export default nextConfig;
