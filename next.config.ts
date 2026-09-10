import type { NextConfig } from "next";

// --- Content-Security-Policy ------------------------------------------------------------------
// Shipped in REPORT-ONLY mode: violations print to the browser console, nothing is blocked.
// To finish it:
//   1. `npm run build && npm start` (test a PRODUCTION build — `next dev`'s HMR needs
//      'unsafe-eval' and would create noise that won't exist in prod).
//   2. Click through everything: create a community, draw a boundary, use the address search,
//      open every map, register as a resident, sign in.
//   3. Note each "Refused to … because it violates … Content-Security-Policy" console line and
//      add the missing origin to the right directive below.
//   4. Flip CSP_ENFORCE to true.
const CSP_ENFORCE = false;

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' covers Next's inline bootstrap/hydration scripts; 'unsafe-eval' is only
  // needed by `next dev` — check whether a prod build still trips it before keeping it.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.carto.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.basemaps.cartocdn.com https://*.carto.com https://nominatim.openstreetmap.org https://overpass-api.de https://overpass.kumi.systems",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

// Baseline security headers applied to every response.
const securityHeaders = [
  {
    key: CSP_ENFORCE ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicy,
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // No `preload` — that's a commitment to the browser preload list that the domain owner
  // should opt into deliberately, not a default.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
