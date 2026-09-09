'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import maplibregl from 'maplibre-gl'
import MaplibreDraw from 'maplibre-gl-draw'
import 'maplibre-gl/dist/maplibre-gl.css'
import 'maplibre-gl-draw/dist/mapbox-gl-draw.css'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import type { Residence } from '@/lib/types'
import type { SuggestionPreview } from '@/lib/overpass'
import { BASEMAP_STYLE, boundsOf, PREVIEW_SELECTED, PREVIEW_UNSELECTED } from '@/lib/mapStyle'

const STATUS_COLOR: Record<Residence['status'], string> = {
  current: '#16a34a',
  unreached: '#9ca3af',
  vacant: '#d97706',
}

export type ResidenceMapEntry = {
  residence: Residence
  residentNames: string[]
}

type DrawInstance = {
  changeMode: (mode: string, options?: Record<string, unknown>) => void
  deleteAll: () => void
  add: (feature: Feature<Polygon | MultiPolygon>) => string[]
}
type DrawEvent = { features: Feature<Polygon | MultiPolygon>[] }

/** A request to edit one existing residence's shape on this map, from outside it entirely (the
 * List's "Draw shape"/"Edit shape" button) — `nonce` so re-requesting the same residence still
 * triggers a fresh response even if residenceId/shape happen to be unchanged. */
export type EditShapeRequest = {
  nonce: number
  residenceId: string
  shape: Feature<Polygon | MultiPolygon> | null
}

/** Save/cancel for an in-progress edit, sent from the List's own Save/Cancel buttons instead of
 * a second set of controls on the map itself — Roman noticed canceling in the list left the map
 * still mid-edit. `nonce` so a repeat of the same action still triggers (matters less here than
 * for EditShapeRequest, but keeps the same shape). */
export type EditShapeCommand = { nonce: number; action: 'save' | 'cancel' }

function toFeatureCollection(entries: ResidenceMapEntry[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: entries
      .filter((e) => e.residence.shape)
      .map((e) => ({
        type: 'Feature',
        geometry: (e.residence.shape as Feature<Polygon | MultiPolygon>).geometry,
        properties: {
          id: e.residence.id,
          label: e.residence.label,
          status: e.residence.status,
          residents: e.residentNames.join(', '),
        },
      })),
  }
}

function toPreviewFeatureCollection(previewSuggestions: SuggestionPreview[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: previewSuggestions.map((s) => ({
      type: 'Feature',
      geometry: s.shape.geometry,
      properties: { label: s.label, selected: s.selected },
    })),
  }
}

/**
 * Steward/resident "visible gap map" — every residence with a drawn shape, color-coded by
 * status. Drawing itself is triggered from outside this component entirely — AddResidenceTools'
 * "draw it yourself" option (a brand-new residence: draw the shape, a small bar asks for its
 * label, submitting creates the residence with that shape already set) and a residence row's
 * "Edit" button (redrawing an existing one, in place). Nothing here starts a draw on its own —
 * Roman wants every way to add/edit a residence to route through the one AddResidenceTools/Edit
 * experience, not scattered buttons on the map itself.
 */
export type MapMode = 'idle' | 'drawing-new' | 'editing-existing'

export default function ResidencesOverviewMap({
  entries,
  boundary,
  previewSuggestions = [],
  isSteward = false,
  blockId,
  selectedResidenceId = null,
  onSelectResidence,
  drawRequest = 0,
  editShapeRequest = null,
  editShapeCommand = null,
  onModeChange,
}: {
  entries: ResidenceMapEntry[]
  boundary: Feature<Polygon | MultiPolygon> | null
  /** Shaped address suggestions not yet added, mirrored from SuggestedAddresses — shown as a distinct preview layer. */
  previewSuggestions?: SuggestionPreview[]
  isSteward?: boolean
  blockId?: string
  /** The residence currently highlighted from the List side, if any — mutual highlighting between list and map. */
  selectedResidenceId?: string | null
  onSelectResidence?: (id: string) => void
  /** Bumped by AddResidenceTools' "draw it yourself" option, from outside this component entirely. */
  drawRequest?: number
  /** Set by a List row's "Draw shape"/"Edit shape" button — puts this map into edit mode for that residence. */
  editShapeRequest?: EditShapeRequest | null
  /** Set by that same List row's Save/Cancel buttons — this map has no Save/Cancel of its own during an edit. */
  editShapeCommand?: EditShapeCommand | null
  /** Reports this map's own draw/edit mode outward — lets ResidencesSection highlight the map and
   * ResidencesWorkspace disable "Add a residence" while a draw/edit is actively in progress. */
  onModeChange?: (mode: MapMode) => void
}) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const drawRef = useRef<DrawInstance | null>(null)
  const onSelectResidenceRef = useRef(onSelectResidence)
  // Mirrors the *last non-null* pendingShape/editingResidenceId — needed because calling setState
  // synchronously during render doesn't just "schedule" a later render the way an Effect-triggered
  // setState does: React detects the in-render update and immediately re-invokes this component
  // function right then, so by the time the save Effect further down captures its closure, it's
  // from that re-invocation, where the editShapeCommand render-time reset (below) has *already*
  // nulled both. Confirmed via Roman's console output: the save Effect logged `pendingShape: null`
  // every time, despite reading values that "should" have still been the pre-reset ones. Updated in
  // a plain Effect (not read/written during render, which the lint rule this repo runs — and this
  // bug itself — both flag as unreliable), guarded to skip whenever the values have *just* been
  // reset to null, so it only ever holds a real shape/id, last-write-wins from whenever they were
  // actually set.
  const pendingEditSnapshotRef = useRef<{
    shape: Feature<Polygon | MultiPolygon> | null
    residenceId: string | null
  }>({ shape: null, residenceId: null })
  // 'editing-existing' covers both redrawing a residence that already has a shape and drawing a
  // first shape for one that doesn't — either way it PATCHes an existing residence rather than
  // creating a new one, so it needs no label step, unlike 'drawing-new'.
  const [mode, setMode] = useState<MapMode>('idle')
  const [editingResidenceId, setEditingResidenceId] = useState<string | null>(null)
  const [pendingShape, setPendingShape] = useState<Feature<Polygon | MultiPolygon> | null>(null)
  const [label, setLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Briefly true right when a fresh polygon finishes drawing, to flash a ring around the label
  // input that then appears — Roman noticed it wasn't obvious where to type the new residence's
  // label ("currently just the little thing on the top right").
  const [justFinishedDrawing, setJustFinishedDrawing] = useState(false)
  // Neither shape-saving fetch used to check its own response — a failed PATCH (auth hiccup,
  // transient network error, whatever) would silently do nothing while the UI had already moved
  // on, which looks exactly like "the shape disappeared and never came back." Surfaced instead of
  // silently swallowed.
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    onSelectResidenceRef.current = onSelectResidence
  }, [onSelectResidence])

  // Keeps pendingEditSnapshotRef pointed at the last real shape/residenceId — skipped whenever
  // they've just been reset to null (drawing-new reset, editShapeRequest reset, or this same
  // command's own reset all clear both together), so the ref only ever moves forward to a genuine
  // value and never gets stomped back to null by the very reset the save Effect needs to see past.
  useEffect(() => {
    if (pendingShape && editingResidenceId) {
      pendingEditSnapshotRef.current = { shape: pendingShape, residenceId: editingResidenceId }
    }
  }, [pendingShape, editingResidenceId])

  // Notifying a parent of this component's own state change is exactly what an Effect is for —
  // unlike the render-time patterns elsewhere in this file, there's no local setState here to
  // trip the set-state-in-effect rule, just a subscription-style callback outward.
  useEffect(() => {
    onModeChange?.(mode)
  }, [mode, onModeChange])

  useEffect(() => {
    if (!containerRef.current) return

    const featureCollection = toFeatureCollection(entries)
    // Normally there's a boundary or at least one shaped residence to frame on. The one exception
    // is bootstrapping a boundary-less community's very first shape via a draw/edit request (see
    // ResidencesSection's canShowMap) — nothing to frame yet, so fall back to a neutral world view
    // rather than not rendering the map at all (which would make that bootstrap impossible).
    const bounds =
      featureCollection.features.length > 0 || boundary
        ? boundary
          ? boundsOf(boundary)
          : (turf.bbox(featureCollection) as [number, number, number, number])
        : null

    // No maxBounds here — a hard clamp requires the *viewport* (this container's aspect ratio)
    // to fit inside the bounds box on every axis, and for a community that's much taller than
    // wide (or vice versa) inside a wide-short card, that forces a much higher zoom than "show
    // the whole thing" needs, hiding most of the long axis. bounds/fitBoundsOptions alone still
    // gives a sensible initial framing; this map's whole point is seeing the full community, so
    // free pan/zoom afterward is the right tradeoff.
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      ...(bounds ? { bounds, fitBoundsOptions: { padding: 30 } } : { center: [0, 20] as [number, number], zoom: 1 }),
      maxPitch: 0,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    let unmounted = false
    let popup: maplibregl.Popup | null = null

    // No visible controls of its own (displayControlsDefault: false, controls: {}) — drawing is
    // driven entirely by the drawRequest/editShapeRequest props from outside, not Draw's default
    // UI or a button on this map, to avoid two competing sets of controls on the same map.
    const draw = new MaplibreDraw({ displayControlsDefault: false, controls: {} }) as unknown as DrawInstance
    map.addControl(draw as unknown as maplibregl.IControl, 'top-left')
    drawRef.current = draw

    map.once('load', () => {
      if (unmounted) return
      map.addSource('residences', { type: 'geojson', data: featureCollection })
      map.addLayer({
        id: 'residences-fill',
        type: 'fill',
        source: 'residences',
        paint: {
          'fill-color': [
            'match',
            ['get', 'status'],
            'current',
            STATUS_COLOR.current,
            'vacant',
            STATUS_COLOR.vacant,
            STATUS_COLOR.unreached,
          ],
          'fill-opacity': 0.45,
        },
      })
      map.addLayer({
        id: 'residences-outline',
        type: 'line',
        source: 'residences',
        paint: {
          'line-color': [
            'match',
            ['get', 'status'],
            'current',
            STATUS_COLOR.current,
            'vacant',
            STATUS_COLOR.vacant,
            STATUS_COLOR.unreached,
          ],
          'line-width': 2,
        },
      })
      // A thin dedicated highlight layer, on top — simpler than making every status color have
      // its own "selected" variant, and it's invisible (empty filter) until something's selected.
      map.addLayer({
        id: 'residences-selected',
        type: 'line',
        source: 'residences',
        filter: ['==', ['get', 'id'], ''],
        paint: { 'line-color': '#1f2937', 'line-width': 4 },
      })

      // Suggested-address previews — not real residences yet, so a distinct blue rather than
      // any status color; checked (about to be added) is bolder than merely suggested.
      map.addSource('suggestions', { type: 'geojson', data: toPreviewFeatureCollection(previewSuggestions) })
      map.addLayer({
        id: 'suggestions-fill',
        type: 'fill',
        source: 'suggestions',
        paint: {
          'fill-color': ['case', ['get', 'selected'], PREVIEW_SELECTED, PREVIEW_UNSELECTED],
          'fill-opacity': ['case', ['get', 'selected'], 0.5, 0.25],
        },
      })
      map.addLayer({
        id: 'suggestions-outline',
        type: 'line',
        source: 'suggestions',
        paint: {
          'line-color': ['case', ['get', 'selected'], PREVIEW_SELECTED, PREVIEW_UNSELECTED],
          'line-width': ['case', ['get', 'selected'], 2, 1.5],
          'line-dasharray': [2, 1.5],
        },
      })

      map.on('mouseenter', 'residences-fill', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'residences-fill', () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('click', 'residences-fill', (e) => {
        const props = e.features?.[0]?.properties
        if (!props) return
        popup?.remove()

        const container = document.createElement('div')
        container.className = 'space-y-0.5'
        const title = document.createElement('p')
        title.className = 'font-medium'
        title.textContent = props.label
        container.appendChild(title)
        // Status line removed entirely per Roman (first Current/Unreached, then Vacant too) —
        // the fill color already carries status at a glance on the map itself; the popup doesn't
        // need to repeat it in text.
        if (props.residents) {
          const residents = document.createElement('p')
          residents.className = 'text-sm'
          residents.textContent = props.residents
          container.appendChild(residents)
        }

        popup = new maplibregl.Popup({ closeButton: true }).setLngLat(e.lngLat).setDOMContent(container).addTo(map)
        if (typeof props.id === 'string') onSelectResidenceRef.current?.(props.id)
      })
      map.on('draw.create', (e: DrawEvent) => {
        const feature = e.features[0]
        if (feature) setPendingShape(feature)
      })
      // Fires while reshaping/dragging an existing feature in direct_select mode (editing an
      // existing residence's shape) — draw.create only covers drawing a brand-new one.
      map.on('draw.update', (e: DrawEvent) => {
        const feature = e.features[0]
        if (feature) setPendingShape(feature)
      })
      mapRef.current = map
    })

    return () => {
      unmounted = true
      mapRef.current = null
      drawRef.current = null
      popup?.remove()
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep an already-open map view in sync when residences are added/edited/moved elsewhere on
  // the page (router.refresh() re-renders this component with new entries, but the mount effect
  // above only runs once — without this, a residence added while Map view is showing wouldn't
  // appear until the whole map got torn down and recreated, which would also reset pan/zoom).
  useEffect(() => {
    const map = mapRef.current
    const source = map?.getSource('residences') as maplibregl.GeoJSONSource | undefined
    if (!source) return
    source.setData(toFeatureCollection(entries))
  }, [entries])

  // Same idea for suggestion previews — updates on every checkbox click, not just when
  // residences actually change.
  useEffect(() => {
    const map = mapRef.current
    const source = map?.getSource('suggestions') as maplibregl.GeoJSONSource | undefined
    if (!source) return
    source.setData(toPreviewFeatureCollection(previewSuggestions))
  }, [previewSuggestions])

  // Mutual highlighting with the List: a residence selected there (or previously selected here)
  // gets a bold outline. Cheaper to flip a filter on a dedicated highlight layer than to rebuild
  // a "case" expression on the main layers every time the selection changes. Excludes whichever
  // residence is currently being edited (see the effect below) so its own highlight never fights
  // with the highlight it'd otherwise also get from being the selected row.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('residences-selected')) return
    const isSelectedButNotEditing = selectedResidenceId && selectedResidenceId !== editingResidenceId
    map.setFilter('residences-selected', ['==', ['get', 'id'], isSelectedButNotEditing ? selectedResidenceId : ''])
  }, [selectedResidenceId, editingResidenceId])

  // A residence being edited gets its live shape drawn by MaplibreDraw on top — the original
  // fill/outline underneath it (plus that thick black "selected" outline, since clicking Edit
  // also selects the row) would otherwise sit right on top of Draw's small drag handles, making
  // them hard to grab. Hide the original rendering of just that one residence while it's active.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('residences-fill')) return
    const hideEdited: maplibregl.FilterSpecification | null = editingResidenceId
      ? ['!=', ['get', 'id'], editingResidenceId]
      : null
    map.setFilter('residences-fill', hideEdited)
    map.setFilter('residences-outline', hideEdited)
  }, [editingResidenceId])

  const cancelDrawOrEdit = () => {
    setMode('idle')
    setEditingResidenceId(null)
    setPendingShape(null)
    setLabel('')
    drawRef.current?.deleteAll()
    drawRef.current?.changeMode('simple_select')
  }

  const submitNewResidence = async () => {
    if (!pendingShape || !label.trim() || !blockId) return
    setSubmitting(true)
    setSaveError(null)

    const res = await fetch(`/api/blocks/${blockId}/residences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels: [label.trim()] }),
    })
    const body = await res.json()

    if (!res.ok) {
      setSubmitting(false)
      setSaveError(body.error ?? 'Failed to add the residence — please try again.')
      return
    }

    const residence = body.residences?.[0] as { id: string } | undefined
    if (residence) {
      const shapeRes = await fetch(`/api/residences/${residence.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shape: pendingShape }),
      })
      if (!shapeRes.ok) {
        // The residence itself was created — only its shape failed to attach. Still refresh so
        // the (shapeless) residence shows up rather than silently vanishing from view too.
        setSubmitting(false)
        setSaveError(`"${label.trim()}" was added, but its shape failed to save — try drawing it again from the list.`)
        cancelDrawOrEdit()
        router.refresh()
        return
      }
    }

    setSubmitting(false)
    cancelDrawOrEdit()
    router.refresh()
  }

  // AddResidenceTools' "draw it yourself" option and a List row's "Draw/Edit shape" button both
  // live outside this map entirely, so neither can call startDrawing()/startEditingShape()
  // directly — they bump drawRequest/editShapeRequest instead. Split in two: the state reset
  // happens during render, comparing against a mirrored previous value — React's recommended way
  // to react to a prop change without an Effect. The actual MapLibre/Draw calls are real side
  // effects on an external system, so those still belong in an Effect, just ones with no setState
  // of their own.
  const [lastDrawRequest, setLastDrawRequest] = useState(drawRequest)
  if (drawRequest !== lastDrawRequest) {
    setLastDrawRequest(drawRequest)
    setMode('drawing-new')
    setEditingResidenceId(null)
    setPendingShape(null)
    setLabel('')
    setSaveError(null)
  }

  const [lastEditRequestNonce, setLastEditRequestNonce] = useState(editShapeRequest?.nonce ?? 0)
  if ((editShapeRequest?.nonce ?? 0) !== lastEditRequestNonce) {
    setLastEditRequestNonce(editShapeRequest?.nonce ?? 0)
    setMode('editing-existing')
    setEditingResidenceId(editShapeRequest?.residenceId ?? null)
    setPendingShape(editShapeRequest?.shape ?? null)
    setLabel('')
    setSaveError(null)
  }

  // Same pattern again for the List's Save/Cancel commands — reset the state here (during
  // render, not an Effect), and fire the actual PATCH (a real side effect) from the plain Effect
  // below, which reads pendingEditSnapshotRef rather than pendingShape/editingResidenceId directly
  // — see that ref's own comment for why.
  const [lastEditCommandNonce, setLastEditCommandNonce] = useState(editShapeCommand?.nonce ?? 0)
  if ((editShapeCommand?.nonce ?? 0) !== lastEditCommandNonce) {
    setLastEditCommandNonce(editShapeCommand?.nonce ?? 0)
    setMode('idle')
    setEditingResidenceId(null)
    setPendingShape(null)
    setLabel('')
    setSaveError(null)
  }

  // Same render-time-comparison approach again, just for a cosmetic flash rather than a real
  // state sync: the moment a fresh polygon finishes (drawing-new only — editing-existing already
  // has its own hint text, no label step needed), start the flash. Turning it back off happens in
  // the Effect below via setTimeout, not here — that's a genuinely deferred callback, not a
  // synchronous setState "directly within" an Effect.
  const [wasPendingShapePresent, setWasPendingShapePresent] = useState(!!pendingShape)
  if (!!pendingShape !== wasPendingShapePresent) {
    setWasPendingShapePresent(!!pendingShape)
    if (mode === 'drawing-new' && pendingShape) setJustFinishedDrawing(true)
  }

  useEffect(() => {
    if (!justFinishedDrawing) return
    const timeout = setTimeout(() => setJustFinishedDrawing(false), 1500)
    return () => clearTimeout(timeout)
  }, [justFinishedDrawing])

  // A resize() first covers the case where this map was mounted while hidden (List view on a
  // narrow screen) and is only now being shown — MapLibre sizes its canvas at construction, so a
  // container that had zero size then needs an explicit nudge once it's actually visible.
  useEffect(() => {
    if (drawRequest === 0) return
    mapRef.current?.resize()
    drawRef.current?.deleteAll()
    drawRef.current?.changeMode('draw_polygon')
  }, [drawRequest])

  useEffect(() => {
    if (!editShapeRequest) return
    mapRef.current?.resize()
    drawRef.current?.deleteAll()
    if (editShapeRequest.shape) {
      const ids = drawRef.current?.add(editShapeRequest.shape)
      drawRef.current?.changeMode('direct_select', { featureId: ids?.[0] })
      // A nudge, not a hard cut to a tight crop — Roman asked to "slightly" zoom and center on
      // the residence being edited, not lose the surrounding context entirely. maxZoom keeps a
      // very small lot from zooming in absurdly far.
      mapRef.current?.fitBounds(boundsOf(editShapeRequest.shape, 0.05), {
        padding: 80,
        maxZoom: 19,
        duration: 500,
      })
    } else {
      drawRef.current?.changeMode('draw_polygon')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editShapeRequest?.nonce])

  // The List's Save/Cancel, not this map's own — reads pendingEditSnapshotRef rather than
  // pendingShape/editingResidenceId directly, since those are already null by the time this runs
  // (the render-time reset above); see the ref's own comment for why. No setState here, matching
  // every other Effect in this file — `fetch` is a genuine side effect, and its `.then()` runs as
  // a separate microtask after this Effect's own synchronous body has already finished, not
  // "directly within" it.
  useEffect(() => {
    if (!editShapeCommand) return
    const { shape, residenceId } = pendingEditSnapshotRef.current
    drawRef.current?.deleteAll()
    drawRef.current?.changeMode('simple_select')
    if (editShapeCommand.action === 'save' && shape && residenceId) {
      fetch(`/api/residences/${residenceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shape }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            setSaveError(body.error ?? 'Failed to save the shape — please try again.')
            return
          }
          router.refresh()
        })
        .catch(() => setSaveError('Failed to save the shape — please try again.'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editShapeCommand?.nonce])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {isSteward && blockId && (mode !== 'idle' || saveError) && (
        <div className="absolute top-3 right-3 z-10">
          {saveError ? (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full pl-4 pr-1.5 py-1.5 shadow-md max-w-xs">
              <span className="text-sm text-red-700">{saveError}</span>
              <button
                onClick={() => setSaveError(null)}
                className="text-sm text-red-700 hover:text-red-900 px-1 cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>
          ) : mode === 'editing-existing' ? (
            // No Save/Cancel here — Roman noticed canceling in the List left this map stuck mid-edit
            // (two disconnected sets of controls for one action). Save/Cancel now live only on the
            // List's own Edit row; this is just a passive hint about what to do on the map itself.
            <div className="bg-surface border border-border rounded-full px-4 py-1.5 shadow-md">
              <span className="text-sm text-muted">
                {editShapeRequest?.shape
                  ? "Drag the shape's points to adjust it"
                  : 'Click to add points, then click the first point again to close the shape'}
              </span>
            </div>
          ) : !pendingShape ? (
            <div className="flex items-center gap-2 bg-surface border border-border rounded-full pl-4 pr-1.5 py-1.5 shadow-md">
              <span className="text-sm text-muted">
                Click to add points, then click the first point again to close the shape
              </span>
              <button
                onClick={cancelDrawOrEdit}
                className="text-sm text-muted hover:text-ink px-1 cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="flex items-center gap-2 bg-surface border border-border rounded-full pl-4 pr-1.5 py-1.5 shadow-md">
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submitNewResidence()
                    }
                    if (e.key === 'Escape') cancelDrawOrEdit()
                  }}
                  placeholder="Label, e.g. 412 Elm St"
                  autoFocus
                  className="text-sm px-2 py-1 focus:outline-none min-w-0 w-40"
                />
                <button
                  onClick={submitNewResidence}
                  disabled={!label.trim() || submitting}
                  className="text-sm px-3 py-1 rounded-full bg-accent text-white hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium shrink-0"
                >
                  {submitting ? 'Adding…' : 'Add'}
                </button>
                <button onClick={cancelDrawOrEdit} className="text-sm text-muted hover:text-ink px-1 cursor-pointer shrink-0">
                  ✕
                </button>
              </div>
              {/* A separate overlay again, not a class on the pill itself — animate-pulse fading
                  the actual text input's opacity while someone's trying to type into it would be
                  actively unusable, not just distracting. Fades out on its own after ~1.5s. */}
              {justFinishedDrawing && (
                <div className="absolute -inset-1 rounded-full ring-4 ring-accent animate-pulse pointer-events-none" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
