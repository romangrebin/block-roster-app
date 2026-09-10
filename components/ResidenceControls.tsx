'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

const inputClass =
  'flex-1 border border-border rounded-lg px-2.5 py-1 text-base font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent'

/**
 * Steward-only inline rename/delete for one residence row. One "Edit" button now does both
 * rename and shape-editing — it opens the rename input here *and* (if `onEditShape` is given,
 * i.e. the community's on a geo_map canvas) puts the big Residences map into edit mode for this
 * residence, per Roman: "just 1 edit button, it does both the shape and the name." Save/Cancel
 * here also drive that same map edit (via `onShapeEditCommand`) — the map itself has no Save/
 * Cancel of its own, since Roman noticed canceling in the list used to leave it stuck mid-edit.
 */
export default function ResidenceControls({
  residenceId,
  label,
  residentCount,
  shape = null,
  onEditShape,
  shapeEditActive = false,
  onShapeEditCommand,
}: {
  residenceId: string
  label: string
  residentCount: number
  shape?: Feature<Polygon | MultiPolygon> | null
  onEditShape?: (residenceId: string, shape: Feature<Polygon | MultiPolygon> | null) => void
  /** True while this specific residence is the one the map is currently mid-edit on — guards
   * against Save/Cancel here accidentally acting on a *different* residence's in-progress map
   * edit, e.g. if a steward opened Edit on this row without having saved/cancelled another one. */
  shapeEditActive?: boolean
  onShapeEditCommand?: (action: 'save' | 'cancel') => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancel = () => {
    setEditing(false)
    setValue(label)
    setError(null)
    if (shapeEditActive) onShapeEditCommand?.('cancel')
  }

  const handleSave = async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    if (trimmed !== label) {
      const res = await fetch(`/api/residences/${residenceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: trimmed }),
      })
      const body = await res.json()
      if (!res.ok) {
        setSubmitting(false)
        setError(body.error ?? 'Failed to rename')
        return
      }
    }
    setSubmitting(false)
    setEditing(false)
    if (shapeEditActive) {
      // Hand off to the map's own PATCH+refresh (ResidencesOverviewMap's editShapeCommand
      // effect) instead of refreshing here too — refreshing immediately raced against that
      // PATCH actually landing, so the page kept re-fetching pre-save data while the map had
      // already cleared its drawn feature, and the shape never visibly came back.
      onShapeEditCommand?.('save')
    } else {
      router.refresh()
    }
  }

  const handleDelete = async () => {
    const warning =
      residentCount > 0
        ? `Delete "${label}"? This also removes its ${residentCount} resident${residentCount === 1 ? '' : 's'}. This cannot be undone.`
        : `Delete "${label}"? This cannot be undone.`
    if (!confirm(warning)) return
    setSubmitting(true)
    const res = await fetch(`/api/residences/${residenceId}`, { method: 'DELETE' })
    setSubmitting(false)
    if (res.ok) router.refresh()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSave()
            }
            if (e.key === 'Escape') cancel()
          }}
          autoFocus
          className={inputClass}
        />
        <button
          onClick={handleSave}
          disabled={submitting || !value.trim()}
          className="text-sm text-accent font-medium cursor-pointer disabled:opacity-40 shrink-0"
        >
          Save
        </button>
        <button onClick={cancel} className="text-sm text-muted cursor-pointer shrink-0">
          Cancel
        </button>
        {error && <span className="text-sm text-red-600 shrink-0">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Pill buttons, not bare text links — this only renders once the row is already selected
          (ResidencesSection's call), so these are now a deliberate reveal rather than something
          always sitting there; worth a bit more visual weight than a plain muted text link. The
          official label itself is shown by the parent row's own heading now (alongside any
          nickname), not repeated here. */}
      <button
        onClick={() => {
          setEditing(true)
          onEditShape?.(residenceId, shape)
        }}
        className="text-sm px-3 py-1 rounded-full border border-border text-ink hover:bg-surface-muted transition-colors cursor-pointer font-medium"
      >
        Edit
      </button>
      <button
        onClick={handleDelete}
        disabled={submitting}
        className="text-sm px-3 py-1 rounded-full border border-border text-muted hover:text-red-600 hover:border-red-300 transition-colors cursor-pointer disabled:opacity-40 font-medium"
      >
        Delete
      </button>
    </div>
  )
}
