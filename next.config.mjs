const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

// Everything the public pages load is served from this origin, fonts included.
// A page that later embeds tours or CDN media adds those origins here.
// 'unsafe-inline' for styles covers React's server-rendered style attributes;
// scripts get no such exemption.
const pageCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Server-only packages must not be traced into the edge/client bundles.
  serverExternalPackages: ['pg', 'ioredis', 'bullmq', 'winston'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...securityHeaders,
          // The dev server's hot reload relies on eval, so the policy is
          // production-only.
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Content-Security-Policy', value: pageCsp }]
            : []),
        ],
      },
      {
        // JSON responses render nothing, so the API's policy allows nothing.
        source: '/api/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'none'; frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
