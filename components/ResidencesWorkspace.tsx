'use client'

import { useMemo, useState } from 'react'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { Residence, Resident, ContactMethod, CanvasType } from '@/lib/types'
import type { SuggestionPreview } from '@/lib/overpass'
import AddResidenceTools from './AddResidenceTools'
import ResidencesSection from './ResidencesSection'
import type { MapMode } from './ResidencesOverviewMap'

type ResidentRow = { resident: Resident; contacts: ContactMethod[] }
type Entry = { residence: Residence; residents: ResidentRow[] }

/**
 * Wraps the steward's add-residence tools and the Residences list/map in one client component so
 * a suggested address's shape can preview on the map while its checkbox is (or isn't) checked —
 * otherwise unrelated server-rendered siblings with no shared state to carry that link.
 *
 * AddResidenceTools is stacked full-width above ResidencesSection rather than in a side column,
 * since a column beside the tall map would reserve empty space below its single button.
 */
export default function ResidencesWorkspace({
  isSteward,
  blockId,
  blockBoundary,
  canvasType,
  entries,
  activeStewards,
  showExportLink,
  viewerEmail,
  viewerResidenceId,
}: {
  isSteward: boolean
  blockId: string
  blockBoundary: Feature<Polygon | MultiPolygon> | null
  canvasType: CanvasType
  entries: Entry[] | null
  activeStewards: { userId: string; stewardId: string }[]
  showExportLink: boolean
  viewerEmail: string | null
  viewerResidenceId: string | null
}) {
  const [previewSuggestions, setPreviewSuggestions] = useState<SuggestionPreview[]>([])
  // Stable across re-renders unless `entries` itself changes — inlining this .map() would
  // hand SuggestedAddresses a brand-new array every render, including the renders *caused by*
  // its own onPreviewChange call below, which fed a fresh (memoized-off-this-array) `visible`
  // back into its effect every time: an infinite update loop.
  const existingLabels = useMemo(() => (entries ?? []).map((e) => e.residence.label), [entries])
  // Incremented to tell ResidencesSection/ResidencesOverviewMap "switch to Map view and start
  // drawing" — the "draw it yourself" option inside AddResidenceTools, which lives outside the
  // map itself and so can't call the map's own startDrawing() directly.
  const [drawRequest, setDrawRequest] = useState(0)
  // Mirrors the map's own draw/edit mode (started here via "draw it yourself," or from a
  // residence row's Edit button) — while it's anything but idle, "Add a residence" collapses to
  // a hint instead of staying clickable and competing with the map for attention.
  const [mapMode, setMapMode] = useState<MapMode>('idle')
  // Matches ResidencesSection's own canShowMap — no point offering "draw it yourself" if there's
  // nothing yet to frame a map view on (no boundary, no shaped residence).
  const canDraw = canvasType === 'geo_map' && (blockBoundary !== null || (entries ?? []).some((e) => e.residence.shape))

  return (
    <div className="space-y-4">
      {isSteward && (
        <AddResidenceTools
          blockId={blockId}
          boundary={blockBoundary}
          existingLabels={existingLabels}
          onPreviewChange={setPreviewSuggestions}
          onRequestDraw={() => setDrawRequest((n) => n + 1)}
          canDraw={canDraw}
          mapMode={mapMode}
        />
      )}

      {entries ? (
        <ResidencesSection
          entries={entries}
          isSteward={isSteward}
          activeStewards={activeStewards}
          blockId={blockId}
          blockBoundary={blockBoundary}
          canvasType={canvasType}
          showExportLink={showExportLink}
          viewerResidenceId={viewerResidenceId}
          previewSuggestions={previewSuggestions}
          drawRequest={drawRequest}
          onMapModeChange={setMapMode}
        />
      ) : viewerEmail ? (
        <p className="text-base text-muted">
          Signed in as {viewerEmail} — you don&apos;t have residents-only access to this community yet.
          Register below, or check with a steward if you&apos;re still waiting on approval.
        </p>
      ) : (
        <p className="text-base text-muted">
          Already registered and approved? Sign in (top right) to see the residents-only directory.
        </p>
      )}
    </div>
  )
}
