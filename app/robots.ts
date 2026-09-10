import type { MetadataRoute } from 'next'

// The landing page is fine to index; nothing else is. Community pages at /<code> additionally
// carry `robots: { index: false }` via app/[code]/layout.tsx since they can't be path-matched
// here — the code *is* the top-level path segment.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/blocks/'],
    },
  }
}
