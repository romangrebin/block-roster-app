'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import {
  suggestAddressesWithinBoundary,
  normalizeAddressLabel,
  type SuggestedAddress,
  type SuggestionPreview,
} from '@/lib/overpass'

type Status = 'idle' | 'loading' | 'loaded' | 'failed'

/**
 * Click-to-add address suggestions within the community's drawn boundary, via OSM's free
 * Overpass API — including each one's shape, when OSM has the address tagged directly on a
 * closed building way (common in this test area; not guaranteed everywhere OSM's mapped).
 * Fetches on demand (a button), not on every page load/mount — a free public API shouldn't get
 * hit every time a steward revisits their own dashboard, and Roman asked for exactly this after
 * noticing it firing on every load.
 */
export default function SuggestedAddresses({
  blockId,
  boundary,
  existingLabels,
  onPreviewChange,
}: {
  blockId: string
  boundary: Feature<Polygon | MultiPolygon>
  existingLabels: string[]
  /** Mirrors shaped suggestions (+ their checked state) up to the Residences map, so it can preview them. */
  onPreviewChange?: (preview: SuggestionPreview[]) => void
}) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('idle')
  const [suggestions, setSuggestions] = useState<SuggestedAddress[]>([])
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  const handleSearch = () => {
    setStatus('loading')
    suggestAddressesWithinBoundary(boundary)
      .then((result) => {
        setSuggestions(result)
        setStatus('loaded')
      })
      .catch(() => setStatus('failed'))
  }

  // Normalized on both sides — suggestion labels come pre-normalized from lib/overpass.ts, but an
  // existing label might have been typed by hand (or added before this normalization existed)
  // and still have its full "Avenue South"-style suffix, which would otherwise dodge this check.
  const existingLower = useMemo(
    () => new Set(existingLabels.map((l) => normalizeAddressLabel(l).toLowerCase())),
    [existingLabels]
  )
  const visible = useMemo(
    () => suggestions.filter((s) => !existingLower.has(normalizeAddressLabel(s.label).toLowerCase())),
    [suggestions, existingLower]
  )

  useEffect(() => {
    onPreviewChange?.(
      visible
        .filter((s): s is SuggestedAddress & { shape: Feature<Polygon | MultiPolygon> } => !!s.shape)
        .map((s) => ({ label: s.label, shape: s.shape, selected: selectedLabels.has(s.label) }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selectedLabels])

  // Clear any preview shapes on unmount (Manage panel closing, navigating away, etc.) rather
  // than leaving stale "about to add" shapes on the map.
  useEffect(() => {
    return () => onPreviewChange?.([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (label: string) => {
    setSelectedLabels((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const allSelected = visible.length > 0 && visible.every((s) => selectedLabels.has(s.label))
  const toggleAll = () => {
    setSelectedLabels(allSelected ? new Set() : new Set(visible.map((s) => s.label)))
  }

  const handleAddSelected = async () => {
    const toAdd = visible.filter((s) => selectedLabels.has(s.label))
    if (toAdd.length === 0) return
    setSubmitting(true)

    const res = await fetch(`/api/blocks/${blockId}/residences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels: toAdd.map((s) => s.label) }),
    })
    const body = await res.json()

    if (res.ok) {
      // Created in the same order the labels were sent, so index-matching back to toAdd is safe.
      await Promise.all(
        (body.residences as { id: string }[]).map((residence, i) => {
          const shape = toAdd[i].shape
          if (!shape) return null
          return fetch(`/api/residences/${residence.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shape }),
          })
        })
      )
    }

    setSubmitting(false)
    setSelectedLabels((prev) => {
      const next = new Set(prev)
      for (const s of toAdd) next.delete(s.label)
      return next
    })
    router.refresh()
  }

  if (status === 'idle') {
    return (
      <button
        onClick={handleSearch}
        className="text-sm px-4 py-1.5 rounded-full border border-border text-ink hover:bg-surface-muted transition-colors cursor-pointer font-medium"
      >
        Search addresses within your community boundary
      </button>
    )
  }

  if (status === 'loading') {
    return <p className="text-sm text-muted">Searching for addresses within your community boundary…</p>
  }

  if (status === 'failed') {
    return (
      <div className="space-y-1.5">
        <p className="text-sm text-red-600">Couldn&apos;t reach OpenStreetMap — try again?</p>
        <button
          onClick={handleSearch}
          className="text-sm px-4 py-1.5 rounded-full border border-border text-ink hover:bg-surface-muted transition-colors cursor-pointer font-medium"
        >
          Retry
        </button>
      </div>
    )
  }

  if (visible.length === 0) {
    return <p className="text-sm text-muted">No new addresses found near your boundary.</p>
  }

  const shapedCount = visible.filter((s) => s.shape).length

  return (
    <div className="space-y-2 border border-border rounded-xl p-3 bg-surface">
      <p className="text-sm font-medium text-ink">
        {visible.length} potential new address{visible.length === 1 ? '' : 'es'} found in your boundary (via
        OpenStreetMap)
      </p>
      {shapedCount > 0 && (
        <p className="text-sm text-muted">
          {shapedCount} of these include a ready-made shape, previewed on the map and drawn automatically on add.
        </p>
      )}
      <button onClick={toggleAll} className="text-sm text-accent hover:underline cursor-pointer font-medium">
        {allSelected ? 'Deselect all' : 'Select all'}
      </button>
      {/* Rows, not checkboxes — clicking anywhere on a row toggles it. Neutral until checked, then
          the same accent-soft highlight used for row selection elsewhere in the app (Residences
          list) — Roman noticed the map's blue preview tint, reused here in an earlier pass, made
          every row look pre-selected even before anything was checked. The map keeps that blue;
          it reads fine there since it's clearly distinct from every residence's own status color. */}
      <ul className="space-y-1 max-h-48 overflow-y-auto">
        {visible.map(({ label, shape }) => {
          const selected = selectedLabels.has(label)
          return (
            <li
              key={label}
              onClick={() => toggle(label)}
              className={`flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2 cursor-pointer border transition-colors ${
                selected
                  ? 'bg-accent-soft border-accent font-medium text-ink'
                  : 'border-border text-ink hover:bg-surface-muted'
              }`}
            >
              <span>{label}</span>
              {!shape && <span className="text-muted text-xs shrink-0">no shape found</span>}
            </li>
          )
        })}
      </ul>
      <button
        onClick={handleAddSelected}
        disabled={selectedLabels.size === 0 || submitting}
        className="text-sm px-4 py-1.5 rounded-full bg-accent text-white hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium"
      >
        {submitting ? 'Adding…' : `Add ${selectedLabels.size} selected`}
      </button>
    </div>
  )
}
