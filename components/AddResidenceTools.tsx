'use client'

import { useState } from 'react'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { SuggestionPreview } from '@/lib/overpass'
import type { MapMode } from './ResidencesOverviewMap'
import AddResidencesForm from './AddResidencesForm'
import SuggestedAddresses from './SuggestedAddresses'

/**
 * Collapses the three ways to add a residence — type a name/address, pick from OSM suggestions,
 * or draw a shape directly on the map — behind one "Add a residence" button. Previously
 * `AddResidencesForm` and `SuggestedAddresses` sat always-visible in their own column; Roman
 * flagged that as cluttered ("too many things on screen at once") and asked for these three to
 * read as one experience rather than three separate widgets.
 */
export default function AddResidenceTools({
  blockId,
  boundary,
  existingLabels,
  onPreviewChange,
  onRequestDraw,
  canDraw,
  mapMode = 'idle',
}: {
  blockId: string
  boundary: Feature<Polygon | MultiPolygon> | null
  existingLabels: string[]
  onPreviewChange: (preview: SuggestionPreview[]) => void
  /** Switches the Residences section to Map view and starts the "draw new residence" tool there. */
  onRequestDraw: () => void
  canDraw: boolean
  /** The big map's own draw/edit mode (started here, or from a residence row's Edit button) —
   * while it's anything but idle, this collapses down to a quiet hint instead of staying
   * clickable and competing with the map for attention. */
  mapMode?: MapMode
}) {
  const [open, setOpen] = useState(false)

  // Force the panel closed if a draw/edit starts on the map while it happened to be open (e.g.
  // a steward opened this, then clicked "Edit" on an existing residence instead) — render-time
  // comparison against a mirrored previous value rather than an Effect, same pattern used
  // elsewhere in this feature for reacting to a prop change without an extra render-after-commit.
  const [wasIdle, setWasIdle] = useState(mapMode === 'idle')
  if ((mapMode === 'idle') !== wasIdle) {
    setWasIdle(mapMode === 'idle')
    if (mapMode !== 'idle') setOpen(false)
  }

  if (mapMode === 'drawing-new') {
    return (
      <p className="text-sm text-muted italic px-1">
        Draw the new residence&apos;s shape on the map below, then give it a label.
      </p>
    )
  }

  if (mapMode === 'editing-existing') {
    return <p className="text-sm text-muted italic px-1">A residence&apos;s shape is being edited on the map below.</p>
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-base px-5 py-3 rounded-full bg-accent text-white hover:bg-accent-dark transition-colors cursor-pointer font-medium shadow-[0_8px_16px_-6px_rgba(194,84,46,0.5)]"
      >
        + Add a residence
      </button>
    )
  }

  return (
    <div className="border border-border rounded-2xl p-4 bg-surface">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-medium text-ink">Add a residence</h3>
        <button onClick={() => setOpen(false)} className="text-sm text-muted hover:text-ink cursor-pointer">
          Done
        </button>
      </div>

      {/* Stacked rows below lg (each its own full-width block, divided by a top border); side by
          side above it (divided by a left border instead) — wide instead of tall once there's
          room, per Roman. divide-x/divide-y only apply between whichever of these three sections
          actually render, so this still looks right whether boundary/canDraw are true or not. */}
      <div className="grid gap-4 divide-y divide-border lg:grid-cols-3 lg:divide-y-0 lg:divide-x">
        <div className="space-y-1.5 lg:pr-4">
          <AddResidencesForm blockId={blockId} />
        </div>

        {boundary && (
          <div className="space-y-1.5 pt-4 lg:pt-0 lg:px-4">
            <p className="text-sm font-medium text-ink">Or pick from nearby addresses</p>
            <SuggestedAddresses
              blockId={blockId}
              boundary={boundary}
              existingLabels={existingLabels}
              onPreviewChange={onPreviewChange}
            />
          </div>
        )}

        {canDraw && (
          <div className="space-y-1.5 pt-4 lg:pt-0 lg:pl-4">
            <p className="text-sm font-medium text-ink">Or draw it yourself</p>
            <button
              onClick={() => {
                onRequestDraw()
                setOpen(false)
              }}
              className="text-sm px-4 py-1.5 rounded-full border border-border text-ink hover:bg-surface-muted transition-colors cursor-pointer font-medium"
            >
              Draw a shape directly on the map
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
