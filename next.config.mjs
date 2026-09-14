/**
 * Upstream da API (chamada servidor→servidor pelo proxy do Next).
 * Em produção vem de NEXT_PUBLIC_API_URL (na Vercel: https://meu-treino-back.onrender.com/api);
 * local cai no backend do Docker. API_UPSTREAM permite sobrescrever sem tocar na outra.
 */
const API_UPSTREAM = (
  process.env.API_UPSTREAM ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3000/api'
).replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const securityHeaders = [
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
   * e back no Render são sites diferentes). Sem isso, toda rota protegida dava 401 no celular.
   */
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_UPSTREAM}/:path*` }];
  },
};

export default nextConfig;
