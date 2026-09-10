import type { Metadata } from 'next'

// A community is reachable only by knowing its code (see lib/blockCode.ts) — it should never
// show up in a search index. Applies to /<code> and /<code>/complete alike.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children
}
