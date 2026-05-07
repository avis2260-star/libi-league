/** @type {import('next').NextConfig} */

// Content-Security-Policy in report-only mode for now.
// Once we've watched the browser console for a few days and confirmed
// nothing legitimate is being blocked, flip the header name to
// "Content-Security-Policy" to enforce it.
const cspDirectives = [
  "default-src 'self'",
  // Next.js injects inline runtime scripts; 'unsafe-eval' is required by
  // Turbopack/webpack in dev. Vercel Speed Insights / Web Analytics load
  // from va.vercel-scripts.com. Tighten with nonces later if desired.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  // Supabase REST + realtime (websockets) + Vercel Insights beacons.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com",
  // Supabase Storage is used to embed PDFs (takanon, etc.) via <iframe>.
  "frame-src 'self' https://*.supabase.co",
  "font-src 'self' data:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
];

const securityHeaders = [
  // Force HTTPS for one year, including subdomains. Only takes effect once
  // the browser sees this header over an https connection (so it's a no-op
  // on http://localhost which is fine).
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  // Disallow framing the site from other origins (clickjacking defense).
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Tell browsers to honor declared Content-Type and not sniff.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't leak full URLs to third parties on outbound links.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Lock down powerful browser features we don't use.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Report-only — observe, don't enforce.
  {
    key: 'Content-Security-Policy-Report-Only',
    value: cspDirectives.join('; '),
  },
];

const nextConfig = {
  images: {
    remotePatterns: [
      {
        // Allow Supabase Storage images. Replace <project-ref> with your actual project ref.
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply to every route.
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
