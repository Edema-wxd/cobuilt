const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

function originOf(url) {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

/**
 * Sent as Content-Security-Policy-Report-Only for now: violations are posted
 * to /api/csp-report and logged, and nothing is blocked. Once the logs show
 * none from real traffic, rename the header to Content-Security-Policy.
 *
 * Inline scripts are allowed because the App Router streams its payload in
 * them. Frames allow any https origin because a 3D tour can be a Matterport or
 * custom viewer page, and images and media allow https for the storage CDN.
 */
const pageCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  [
    "connect-src 'self'",
    'https://*.uploadthing.com https://utfs.io https://*.ufs.sh',
    originOf(process.env.NEXT_PUBLIC_NEON_AUTH_URL),
  ]
    .filter(Boolean)
    .join(' '),
  "media-src 'self' blob: https:",
  'frame-src https:',
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'report-uri /api/csp-report',
  'report-to csp',
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Server-only packages must not be traced into the edge/client bundles.
  serverExternalPackages: ['pg', 'ioredis', 'bullmq', 'winston', '@sentry/node'],
  /**
   * `next/image` resizes the gallery's photographs (docs/decisions.md §2.24):
   * files on this site, and files stored with UploadThing. Any other host an
   * editor links to is shown unoptimised (`isOptimisableImage` in
   * src/lib/gallery.ts) rather than fetched by the server. An UploadThing URL
   * names an immutable file, so a resized copy is kept for a month.
   */
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'utfs.io', pathname: '/f/**' },
      { protocol: 'https', hostname: '*.ufs.sh', pathname: '/f/**' },
    ],
    // 75 for grid tiles, 85 for the full-screen viewer.
    qualities: [75, 85],
    minimumCacheTTL: 2_678_400,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...securityHeaders,
          // The dev server's hot reload relies on eval, which would flood the
          // report endpoint, so the policy is production-only.
          ...(process.env.NODE_ENV === 'production'
            ? [
                { key: 'Content-Security-Policy-Report-Only', value: pageCsp },
                { key: 'Reporting-Endpoints', value: 'csp="/api/csp-report"' },
              ]
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
