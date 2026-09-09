'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

type TabKey = 'community' | 'library' | 'my-info' | 'manage'

/**
 * Splits the community page into tabs once there's more than one thing to show a signed-in
 * viewer — Roman: "right now it's just kinda a single page with all the things on it," asked for
 * separate views for viewing the community, managing it, and a resident's own profile. Takes
 * already-rendered content as props rather than owning any data-fetching itself — the parent
 * Server Component still does every access check (isSteward/viewerResident) and simply omits a
 * section's prop when it doesn't apply, which also decides whether that tab appears at all.
 *
 * All tabs render simultaneously in the DOM (hidden/block, not a conditional unmount) — the
 * Community tab holds the Residences map, and unmounting/remounting a MapLibre map on every tab
 * switch would reset its pan/zoom and cost a re-fetch of every tile, the same reason the List/Map
 * toggle elsewhere on this page works the same way.
 */
export default function CommunityTabs({
  community,
  library,
  myInfo,
  manage,
}: {
  community: ReactNode
  library?: ReactNode
  myInfo?: ReactNode
  manage?: ReactNode
}) {
  const tabs: { key: TabKey; label: string; content: ReactNode }[] = [
    { key: 'community', label: 'Community', content: community },
    ...(library ? [{ key: 'library' as const, label: 'Lending Library', content: library }] : []),
    ...(myInfo ? [{ key: 'my-info' as const, label: 'My info', content: myInfo }] : []),
    ...(manage ? [{ key: 'manage' as const, label: 'Manage', content: manage }] : []),
  ]

  const [active, setActive] = useState<TabKey>('community')

  // Nothing to switch between for a plain approved resident with no extra tabs yet — the bar
  // itself would just be visual noise for a single option.
  if (tabs.length <= 1) return <>{community}</>

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2 text-base font-medium cursor-pointer border-b-2 -mb-px transition-colors ${
              active === tab.key
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} className={active === tab.key ? 'block' : 'hidden'}>
          {tab.content}
        </div>
      ))}
    </div>
  )
}
