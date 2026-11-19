'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

type TabKey = 'join' | 'community' | 'library' | 'expedition' | 'print' | 'my-info' | 'manage'

/**
 * Splits the community page into tabs once there's more than one thing to show — the same
 * structure for signed-out visitors (Join, Print) and for members (Community, Manage, …). Takes
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
  join,
  community,
  library,
  expedition,
  print,
  myInfo,
  manage,
}: {
  join?: ReactNode
  community?: ReactNode
  library?: ReactNode
  expedition?: ReactNode
  print?: ReactNode
  myInfo?: ReactNode
  manage?: ReactNode
}) {
  const tabs: { key: TabKey; label: string; content: ReactNode }[] = [
    ...(join ? [{ key: 'join' as const, label: 'Join', content: join }] : []),
    ...(community ? [{ key: 'community' as const, label: 'Community', content: community }] : []),
    ...(library ? [{ key: 'library' as const, label: 'Lending Library', content: library }] : []),
    ...(expedition ? [{ key: 'expedition' as const, label: 'Expedition', content: expedition }] : []),
    ...(print ? [{ key: 'print' as const, label: 'Print', content: print }] : []),
    ...(myInfo ? [{ key: 'my-info' as const, label: 'My info', content: myInfo }] : []),
    ...(manage ? [{ key: 'manage' as const, label: 'Manage', content: manage }] : []),
  ]

  const [active, setActive] = useState<TabKey>(tabs[0]?.key ?? 'community')

  // With nothing to switch between, the bar itself would just be visual noise.
  if (tabs.length <= 1) return <>{tabs[0]?.content}</>

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-border overflow-x-auto print:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            data-umami-event="open-tab"
            data-umami-event-tab={tab.label}
            className={`px-4 py-2 text-base font-medium whitespace-nowrap cursor-pointer border-b-2 -mb-px transition-colors ${
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
