'use client'

import { useState } from 'react'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import DrawableMap from './DrawableMap'
import BoundarySizeNote from './BoundarySizeNote'
import { useSaveAndRefresh } from './useSaveAndRefresh'
import { validatePolygonGeometry, MAX_BLOCK_AREA_KM2 } from '@/lib/geometryValidation'

type Boundary = Feature<Polygon | MultiPolygon>

/** Manage-tab control for redrawing the community boundary. The map only mounts while editing. */
export default function BoundaryEditor({ blockId, boundary }: { blockId: string; boundary: Boundary | null }) {
  const { isPending: saving, saveAndRefresh } = useSaveAndRefresh()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Boundary | null>(boundary)
  const [error, setError] = useState<string | null>(null)

  const check = draft ? validatePolygonGeometry(draft, MAX_BLOCK_AREA_KM2) : null

  const close = () => {
    setEditing(false)
    setDraft(boundary)
    setError(null)
  }

  const save = () => {
    if (!draft || !check?.ok) return
    setError(null)
    saveAndRefresh(async () => {
      const res = await fetch(`/api/blocks/${blockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boundary: draft }),
      })
      if (!res.ok) setError((await res.json()).error ?? 'Failed to save boundary')
      return res.ok
    }, () => setEditing(false))
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-medium text-ink">Boundary</p>
          <p className="text-sm text-muted">The area your community covers. Smaller is better, one block is ideal.</p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-sm px-4 py-2 rounded-full border border-border text-ink hover:bg-surface transition-colors cursor-pointer font-medium"
        >
          {boundary ? 'Edit boundary' : 'Draw boundary'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-base font-medium text-ink">
        Boundary <span className="text-muted font-normal">(drag the corners, or use the trash icon to start over)</span>
      </p>
      <div className="h-[28rem] rounded-2xl overflow-hidden border border-border">
        <DrawableMap initialGeojson={boundary} onChange={setDraft} />
      </div>
      {draft && check && <BoundarySizeNote boundary={draft} check={check} />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || !check?.ok}
          className="text-sm px-4 py-2 rounded-full bg-accent text-white hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium"
        >
          {saving ? 'Saving…' : 'Save boundary'}
        </button>
        <button onClick={close} className="text-sm px-4 py-2 rounded-full text-muted hover:text-ink cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  )
}
