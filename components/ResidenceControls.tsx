'use client'

import { useState } from 'react'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { MAX_TEXT } from '@/lib/validation'
import { useSaveAndRefresh } from './useSaveAndRefresh'

const inputClass =
  'w-full border border-border rounded-lg px-2.5 py-1 text-base font-medium text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent'

/**
 * Steward-only rename / delete / shape-edit for one residence, shown in its detail panel.
 * "Edit" opens the rename input only. From there an "Edit shape" button (present on a geo_map
 * canvas) hands the residence's shape to the big map for editing — a deliberate second step,
 * not an automatic view switch, which Roman found jarring on a phone. Save commits both the
 * rename and, if a shape edit is in progress, the shape (via `onShapeEditCommand` — the map has
 * no Save/Cancel of its own, since canceling elsewhere used to leave it stuck mid-edit).
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
  const { isPending, saveAndRefresh } = useSaveAndRefresh()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)
  const [renamingBeforeShapeSave, setRenamingBeforeShapeSave] = useState(false)
  const submitting = isPending || renamingBeforeShapeSave
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
    setError(null)

    const renameIfChanged = async () => {
      if (trimmed === label) return true
      const res = await fetch(`/api/residences/${residenceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: trimmed }),
      })
      if (!res.ok) setError((await res.json()).error ?? 'Failed to rename')
      return res.ok
    }

    if (!shapeEditActive) {
      saveAndRefresh(renameIfChanged, () => setEditing(false))
      return
    }

    // Hand off to the map's own PATCH+refresh (ResidencesOverviewMap's editShapeCommand
    // effect) instead of refreshing here too — refreshing immediately raced against that
    // PATCH actually landing, so the page kept re-fetching pre-save data while the map had
    // already cleared its drawn feature, and the shape never visibly came back.
    setRenamingBeforeShapeSave(true)
    const renamed = await renameIfChanged()
    setRenamingBeforeShapeSave(false)
    if (!renamed) return
    setEditing(false)
    onShapeEditCommand?.('save')
  }

  const handleDelete = () => {
    const warning =
      residentCount > 0
        ? `Delete "${label}"? This also removes its ${residentCount} resident${residentCount === 1 ? '' : 's'}. This cannot be undone.`
        : `Delete "${label}"? This cannot be undone.`
    if (!confirm(warning)) return
    saveAndRefresh(async () => (await fetch(`/api/residences/${residenceId}`, { method: 'DELETE' })).ok)
  }

  if (editing) {
    return (
      <div className="w-full space-y-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={MAX_TEXT.label}
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
        <div className="flex items-center gap-3 flex-wrap">
          {onEditShape &&
            (shapeEditActive ? (
              <span className="text-sm text-muted">Editing the shape on the map — Save to keep it.</span>
            ) : (
              <button
                onClick={() => onEditShape(residenceId, shape)}
                className="text-sm px-3 py-1 rounded-full border border-border text-ink hover:bg-surface-muted transition-colors cursor-pointer font-medium"
              >
                Edit shape
              </button>
            ))}
          <button
            onClick={handleSave}
            disabled={submitting || !value.trim()}
            className="text-sm text-accent font-medium cursor-pointer disabled:opacity-40"
          >
            Save
          </button>
          <button onClick={cancel} className="text-sm text-muted cursor-pointer">
            Cancel
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Pill buttons, not bare text links — this only renders once the row is already selected
          (ResidencesSection's call), so these are now a deliberate reveal rather than something
          always sitting there; worth a bit more visual weight than a plain muted text link. The
          official label itself is shown by the parent row's own heading now (alongside any
          nickname), not repeated here. "Edit shape" is a second step once editing, not part of
          this button — see the doc comment. */}
      <button
        onClick={() => setEditing(true)}
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
