import type { NextConfig } from "next";

// --- Content-Security-Policy ------------------------------------------------------------------
// Enforcing, after a report-only pass against a production build (create a community, draw a
// boundary, address search + suggestions, maps, sign-in — all clean). If a later change needs
// a new origin: flip CSP_ENFORCE to false, `npm run build && npm start`, reproduce with the
// console open, add the origin the "Refused to …" line names, then flip back.
const CSP_ENFORCE = true;

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' covers Next's inline bootstrap/hydration scripts. 'unsafe-eval' was kept
  // as a precaution (the report-only pass didn't flag script-src); dropping it is possible
  // future tightening, its own test.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data:",
  // basemaps.cartocdn.com is used bare (no subdomain), which `*.basemaps.cartocdn.com` does
  // NOT match — both forms are listed. MapLibre fetches raster tiles via fetch(), so the CARTO
  // host has to be in connect-src too, not just img-src.
  "img-src 'self' data: blob: https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://*.carto.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://*.carto.com https://fonts.openmaptiles.org https://nominatim.openstreetmap.org https://overpass-api.de https://overpass.kumi.systems",
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
