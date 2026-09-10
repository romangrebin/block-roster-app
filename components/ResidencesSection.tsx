'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { Residence, Resident, ContactMethod, CanvasType } from '@/lib/types'
import type { SuggestionPreview } from '@/lib/overpass'
import ApproveResidentButton from './ApproveResidentButton'
import PromoteToStewardButton from './PromoteToStewardButton'
import MoveResidentOutButton from './MoveResidentOutButton'
import RemovePendingResidentButton from './RemovePendingResidentButton'
import ResidenceControls from './ResidenceControls'
import ResidenceNicknameEditor from './ResidenceNicknameEditor'
import ResidencesOverviewMap, { type EditShapeRequest, type EditShapeCommand, type MapMode } from './ResidencesOverviewMap'

type ResidentRow = { resident: Resident; contacts: ContactMethod[] }
type Entry = { residence: Residence; residents: ResidentRow[] }

function residenceRowId(residenceId: string) {
  return `residence-row-${residenceId}`
}

// Monotonic tag for the map's edit request/command props — the map compares it numerically to
// re-fire on a repeated request (see ResidencesOverviewMap). A plain counter, not Date.now(),
// so it stays pure; module-scoped is fine, only one ResidencesSection is ever mounted.
let mapEditSeq = 0
const nextMapEditSeq = () => (mapEditSeq += 1)

/**
 * The residences workspace on /<code>.
 *
 * Layout, wide screens: a compact one-line-per-residence list (its own scroll area, so the map
 * stays put while you scan it), the map, and — under the map — a detail panel for whichever
 * residence is selected (nickname, per-resident cards, Edit/Delete). A filter box narrows the
 * list. Selecting on the list or the map drives the same panel.
 *
 * Layout, phones (< lg): a List/Map toggle for browsing, and tapping a residence (row or shape)
 * pushes a full-screen detail view with a back button — one thing at a time. Back returns to
 * whichever view it came from, since `view` is preserved. While a shape is being edited the map
 * and the detail show stacked (the detail holds Save/Cancel); a brand-new-shape draw shows just
 * the map (its label input lives on the map itself).
 */
export default function ResidencesSection({
  entries,
  isSteward,
  activeStewardUserIds,
  blockId,
  blockBoundary,
  canvasType,
  showExportLink,
  viewerResidenceId = null,
  previewSuggestions = [],
  drawRequest = 0,
  onMapModeChange,
}: {
  entries: Entry[]
  isSteward: boolean
  activeStewardUserIds: string[]
  blockId: string
  blockBoundary: Feature<Polygon | MultiPolygon> | null
  canvasType: CanvasType
  showExportLink: boolean
  /** The signed-in viewer's own residence, if they're an approved resident of one — lets that one
   * residence's nickname be edited even by a non-steward, without opening it up to every residence. */
  viewerResidenceId?: string | null
  previewSuggestions?: SuggestionPreview[]
  /** Bumped by AddResidenceTools' "draw it yourself" option — forces Map view so the draw tool is actually visible. */
  drawRequest?: number
  /** Forwarded from the map, further up to ResidencesWorkspace so it can disable "Add a residence" while a draw/edit is active. */
  onMapModeChange?: (mode: MapMode) => void
}) {
  const [view, setView] = useState<'list' | 'map'>('list')
  const [selectedResidenceId, setSelectedResidenceId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [editShapeRequest, setEditShapeRequest] = useState<EditShapeRequest | null>(null)
  const [editShapeCommand, setEditShapeCommand] = useState<EditShapeCommand | null>(null)
  const [mapMode, setMapMode] = useState<MapMode>('idle')

  const stewardUserIds = new Set(activeStewardUserIds)
  const shapedCount = entries.filter((e) => e.residence.shape).length
  // Also true once a draw/edit request is in flight — lets a steward bootstrap a community's very
  // first shape even before a boundary exists or any other residence has one (the map falls back
  // to a neutral world view in that case; see ResidencesOverviewMap).
  const canShowMap =
    canvasType === 'geo_map' && (blockBoundary !== null || shapedCount > 0 || drawRequest > 0 || !!editShapeRequest)

  const selectedEntry = entries.find((e) => e.residence.id === selectedResidenceId) ?? null
  const editingShape = mapMode === 'editing-existing'
  const drawingNew = mapMode === 'drawing-new'
  const busyOnMap = editingShape || drawingNew

  // Which region a phone shows right now (on lg+ all three render together via `lg:` classes).
  // `editShapeRequest` covers the beat between "Edit shape" being tapped and the map confirming
  // `editing-existing` mode back — without it the map would flash hidden in between.
  const mobileShowsDetail = selectedEntry !== null && !drawingNew
  const mobileShowsMap =
    drawingNew || editingShape || !!editShapeRequest || (selectedEntry === null && view === 'map')
  const mobileShowsList = selectedEntry === null && !busyOnMap && view === 'list'

  const query = filter.trim().toLowerCase()
  const visibleEntries = useMemo(() => {
    if (!query) return entries
    return entries.filter(
      (e) =>
        (e.residence.nickname ?? '').toLowerCase().includes(query) ||
        e.residence.label.toLowerCase().includes(query)
    )
  }, [entries, query])

  const requestEditShape = (residenceId: string, shape: Feature<Polygon | MultiPolygon> | null) => {
    setEditShapeRequest({ nonce: nextMapEditSeq(), residenceId, shape })
    setView('map')
  }

  const handleMapModeChange = (m: MapMode) => {
    // Shape edit finished (saved or canceled) — drop the request so the phone stops showing the
    // map and `selectResidence`'s "cancel in-flight edit" guard doesn't misfire later.
    if (m === 'idle' && mapMode === 'editing-existing') setEditShapeRequest(null)
    setMapMode(m)
    onMapModeChange?.(m)
  }

  // True only for the one residence the map is actually mid-edit on right now — guards
  // ResidenceControls' Save/Cancel from sending a shape command that would land on some *other*
  // residence's in-progress edit.
  const isShapeEditActiveFor = (residenceId: string) =>
    mapMode === 'editing-existing' && editShapeRequest?.residenceId === residenceId

  const sendShapeEditCommand = (action: 'save' | 'cancel') => {
    setEditShapeCommand({ nonce: nextMapEditSeq(), action })
  }

  // Below `lg`, Map is only visible when the toggle is set to it — a draw request from outside
  // (AddResidenceTools) needs to force that, or the draw tool would start on a hidden map.
  // Derived during render (comparing against a mirrored previous value) rather than in an Effect.
  const [lastDrawRequest, setLastDrawRequest] = useState(drawRequest)
  if (drawRequest !== lastDrawRequest) {
    setLastDrawRequest(drawRequest)
    setView('map')
  }

  // Selecting from the map should bring the matching row into view in the list.
  useEffect(() => {
    if (!selectedResidenceId) return
    document.getElementById(residenceRowId(selectedResidenceId))?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }, [selectedResidenceId])

  // The list has its own capped scroll area (lg only) — track whether there's content hidden
  // above / below the current scroll position, so each edge can show a fade + caret.
  const listScrollRef = useRef<HTMLDivElement>(null)
  const [listEdges, setListEdges] = useState({ top: false, bottom: false })
  useEffect(() => {
    const el = listScrollRef.current
    if (!el) return
    const update = () => {
      const overflowing = el.scrollHeight > el.clientHeight + 1
      setListEdges({
        top: overflowing && el.scrollTop > 4,
        bottom: overflowing && el.scrollTop + el.clientHeight < el.scrollHeight - 4,
      })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [visibleEntries.length])

  // Phones only: when a shape edit starts (via "Edit shape" in the detail panel), bring the map
  // to the top of the viewport — it appears stacked above the detail, and Save lives in the
  // detail just below it.
  const mapRegionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (editingShape) {
      mapRegionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [editingShape])

  const selectResidence = (id: string) => {
    const next = selectedResidenceId === id ? null : id
    // Leaving a residence that's mid shape-edit — end that edit rather than letting the map
    // stay stuck on the old one. ResidenceControls is keyed by residence id (below) so its
    // rename/editing state resets on its own; this handles the map side.
    if (next !== selectedResidenceId && editShapeRequest) {
      sendShapeEditCommand('cancel')
      setEditShapeRequest(null)
    }
    setSelectedResidenceId(next)
  }

  // ── Pieces ────────────────────────────────────────────────────────────────

  const filterBox = entries.length > 6 && (
    <input
      type="text"
      value={filter}
      onChange={(e) => setFilter(e.target.value)}
      placeholder="Filter by address or nickname…"
      className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
    />
  )

  const listContent =
    entries.length === 0 ? (
      <p className="text-base text-muted">
        {isSteward ? 'No residences yet — add some.' : 'No residences have been set up for this community yet.'}
      </p>
    ) : (
      <div className="space-y-2">
        {filterBox}
        {visibleEntries.length === 0 ? (
          <p className="text-sm text-muted">No residences match &ldquo;{filter.trim()}&rdquo;.</p>
        ) : (
          <div className="relative border border-border rounded-2xl bg-surface overflow-hidden">
            <div ref={listScrollRef} className="lg:max-h-[34rem] lg:overflow-y-auto">
              <ul className="divide-y divide-border">
                {visibleEntries.map(({ residence, residents }) => {
                  const selected = residence.id === selectedResidenceId
                  const hasResidents = residents.length > 0
                  const firstNames = residents
                    .map((r) => r.resident.name.trim().split(/\s+/)[0])
                    .filter(Boolean)
                  const namesLabel =
                    firstNames.length > 2
                      ? `${firstNames.slice(0, 2).join(', ')} +${firstNames.length - 2}`
                      : firstNames.join(', ')
                  return (
                    <li
                      key={residence.id}
                      id={residenceRowId(residence.id)}
                      onClick={() => selectResidence(residence.id)}
                      className={`@container flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition-colors ${
                        selected ? 'bg-accent-soft' : 'hover:bg-surface-muted'
                      }`}
                    >
                      {/* Green = someone's registered here, hollow = nobody yet (the "gap" the
                          roster is meant to close). */}
                      <span
                        title={hasResidents ? `${residents.length} registered` : 'No one registered yet'}
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          hasResidents ? 'bg-green-500' : 'border border-border'
                        }`}
                      />
                      <span className="flex-1 min-w-0 text-base text-ink break-words">
                        {residence.nickname || residence.label}
                        {residence.nickname && (
                          <span className="text-sm text-muted"> · {residence.label}</span>
                        )}
                      </span>
                      {hasResidents && (
                        <>
                          {/* First names when the row is wide enough for them (container query
                              on the <li>), the count badge as the fallback when it isn't. The
                              @sm threshold (24rem) is a one-word tweak. */}
                          <span className="hidden @sm:block shrink-0 max-w-40 truncate text-sm text-muted">
                            {namesLabel}
                          </span>
                          <span className="@sm:hidden shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium bg-surface-muted text-muted">
                            {residents.length}
                          </span>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
            {/* Fade + caret at whichever edge has hidden content — the only cue that the capped
                list scrolls (both hidden on phones, where the list isn't capped). */}
            {listEdges.top && (
              <div className="pointer-events-none absolute inset-x-0 top-0 h-9 flex items-start justify-center bg-gradient-to-b from-surface via-surface/85 to-transparent">
                <svg
                  viewBox="0 0 12 12"
                  className="w-4 h-4 mt-0.5 text-muted"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 7.5L6 4.5L9 7.5" />
                </svg>
              </div>
            )}
            {listEdges.bottom && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-9 flex items-end justify-center bg-gradient-to-t from-surface via-surface/85 to-transparent">
                <svg
                  viewBox="0 0 12 12"
                  className="w-4 h-4 mb-0.5 text-muted"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 4.5L6 7.5L9 4.5" />
                </svg>
              </div>
            )}
          </div>
        )}
      </div>
    )

  const renderResidentCard = ({ resident, contacts }: ResidentRow) => {
    const email = contacts.find((c) => c.type === 'email')
    const phone = contacts.find((c) => c.type === 'phone')
    const isAlreadySteward = contacts.some((c) => c.userId && stewardUserIds.has(c.userId))
    return (
      <li
        key={resident.id}
        className="rounded-lg border border-border bg-surface-muted px-3 py-2.5 space-y-2"
      >
        <div className="text-base">
          <span className="text-ink font-medium break-words">{resident.name}</span>
          {email && (
            <span className="text-sm text-muted break-words">
              {' '}
              — {email.value}
              {isSteward && !email.verifiedAt && ' (unverified)'}
            </span>
          )}
          {phone && <span className="text-sm text-muted"> · {phone.value}</span>}
          {resident.blurb && (
            <span className="block text-sm text-muted italic mt-0.5">{resident.blurb}</span>
          )}
        </div>
        {isSteward && resident.status === 'pending' && email?.verifiedAt && (
          <div className="flex items-center gap-2 flex-wrap">
            <ApproveResidentButton residentId={resident.id} />
            <RemovePendingResidentButton residentId={resident.id} residentName={resident.name} />
          </div>
        )}
        {isSteward && resident.status === 'pending' && !email?.verifiedAt && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted">awaiting verification</span>
            <RemovePendingResidentButton residentId={resident.id} residentName={resident.name} />
          </div>
        )}
        {isSteward && resident.status === 'approved' && (
          <div className="flex items-center gap-2 flex-wrap">
            {isAlreadySteward ? (
              <span className="text-sm text-accent font-medium">Steward</span>
            ) : (
              <PromoteToStewardButton residentId={resident.id} residentName={resident.name} />
            )}
            <MoveResidentOutButton residentId={resident.id} residentName={resident.name} />
          </div>
        )}
        {isSteward && resident.status === 'moved_out' && (
          <span className="text-sm text-muted">moved out</span>
        )}
      </li>
    )
  }

  const renderDetail = ({ residence, residents }: Entry) => {
    const canEditNickname = isSteward || residence.id === viewerResidenceId
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-lg font-medium text-ink break-words">
              {residence.nickname || residence.label}
            </h3>
            {residence.nickname && <p className="text-sm text-muted break-words">{residence.label}</p>}
          </div>
          {isSteward && (
            <ResidenceControls
              key={residence.id}
              residenceId={residence.id}
              label={residence.label}
              residentCount={residents.length}
              shape={residence.shape as Feature<Polygon | MultiPolygon> | null}
              onEditShape={canvasType === 'geo_map' ? requestEditShape : undefined}
              shapeEditActive={canvasType === 'geo_map' && isShapeEditActiveFor(residence.id)}
              onShapeEditCommand={sendShapeEditCommand}
            />
          )}
        </div>

        {canEditNickname && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted">Nickname:</span>
            <ResidenceNicknameEditor residenceId={residence.id} nickname={residence.nickname} />
          </div>
        )}

        <div className="border-t border-border pt-3">
          {residents.length === 0 ? (
            <p className="text-sm text-muted">No residents registered here yet.</p>
          ) : (
            <ul className="space-y-2">{residents.map(renderResidentCard)}</ul>
          )}
        </div>
      </div>
    )
  }

  const detailEmptyState = (
    <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted">
      {isSteward
        ? 'Select a residence to see or manage it.'
        : 'Select a residence to see who lives there.'}
    </div>
  )

  const mapContent = canShowMap && (
    <div className="space-y-1.5">
      {mapMode === 'drawing-new' && (
        <p className="text-sm text-green-700 font-medium">
          Draw the new residence&apos;s shape on the map below, then give it a label.
        </p>
      )}
      <div className="relative">
        <div
          className={`${editingShape ? 'h-56' : 'h-96'} lg:h-[28rem] rounded-2xl overflow-hidden border-2 transition-colors duration-300 ${
            mapMode === 'drawing-new' ? 'border-green-400' : 'border-border'
          }`}
        >
          <ResidencesOverviewMap
            residences={entries.map((e) => e.residence)}
            occupiedResidenceIds={entries.filter((e) => e.residents.length > 0).map((e) => e.residence.id)}
            boundary={blockBoundary}
            previewSuggestions={previewSuggestions}
            isSteward={isSteward}
            blockId={blockId}
            selectedResidenceId={selectedResidenceId}
            onSelectResidence={selectResidence}
            drawRequest={drawRequest}
            editShapeRequest={editShapeRequest}
            editShapeCommand={editShapeCommand}
            onModeChange={handleMapModeChange}
          />
        </div>
        {/* A separate overlay, not a class on the map's own container — animate-pulse fades
            opacity, and the map container also holds the live MapLibre canvas, which shouldn't
            itself fade in and out. This pulses just the ring drawing the eye to it. */}
        {mapMode === 'drawing-new' && (
          <div className="absolute inset-0 rounded-2xl ring-4 ring-green-400 animate-pulse pointer-events-none" />
        )}
      </div>
      {shapedCount < entries.length && (
        <p className="text-sm text-muted">
          {entries.length - shapedCount} residence{entries.length - shapedCount === 1 ? '' : 's'} without a drawn
          shape {entries.length - shapedCount === 1 ? "isn't" : "aren't"} shown here — check the list for the rest.
        </p>
      )}
    </div>
  )

  // ── Layout ────────────────────────────────────────────────────────────────

  const header = (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-baseline gap-3">
        <h2 className="text-lg font-medium text-ink">Residences</h2>
        {showExportLink && (
          <a href={`/api/blocks/${blockId}/export`} className="text-sm text-accent hover:underline">
            Export CSV
          </a>
        )}
      </div>
      {canShowMap && selectedEntry === null && !busyOnMap && (
        <div className="lg:hidden flex rounded-full border border-border overflow-hidden text-sm">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1 cursor-pointer transition-colors ${view === 'list' ? 'bg-accent text-white' : 'text-muted hover:bg-surface-muted'}`}
          >
            List
          </button>
          <button
            onClick={() => setView('map')}
            className={`px-3 py-1 cursor-pointer transition-colors ${view === 'map' ? 'bg-accent text-white' : 'text-muted hover:bg-surface-muted'}`}
          >
            Map
          </button>
        </div>
      )}
    </div>
  )

  const backButton = (
    <button
      onClick={() => setSelectedResidenceId(null)}
      className="lg:hidden mb-2 inline-flex items-center gap-1 text-sm text-accent cursor-pointer"
    >
      <span aria-hidden>←</span> Residences
    </button>
  )

  if (!canShowMap) {
    // List-only canvas (or a geo_map community with nothing to frame a map on yet). No map, no
    // toggle — just the list and, when something's picked, its detail (full-screen on a phone,
    // beside the list on wide screens).
    return (
      <div className="space-y-3">
        {header}
        <div className="lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
          <div className={`${mobileShowsDetail ? 'hidden' : 'block'} lg:block`}>{listContent}</div>
          <div className={`${mobileShowsDetail ? 'block' : 'hidden'} lg:block`}>
            {selectedEntry ? (
              <>
                {backButton}
                {renderDetail(selectedEntry)}
              </>
            ) : (
              <div className="hidden lg:block">{detailEmptyState}</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {header}
      {/* lg+: list spans both rows of a 1fr/2fr grid; map is row 1 of column 2, the detail
          panel row 2. The list has its own scroll so scanning it doesn't move the map. */}
      <div className="lg:grid lg:grid-cols-[1fr_2fr] lg:gap-x-4 lg:items-start">
        <div
          className={`${mobileShowsList ? 'block' : 'hidden'} lg:block lg:col-start-1 lg:row-start-1 lg:row-span-2`}
        >
          {listContent}
        </div>

        <div
          ref={mapRegionRef}
          className={`${mobileShowsMap ? 'block' : 'hidden'} lg:block lg:col-start-2 lg:row-start-1`}
        >
          {mapContent}
        </div>

        <div
          className={`${mobileShowsDetail ? 'block' : 'hidden'} lg:block lg:col-start-2 lg:row-start-2 lg:mt-4`}
        >
          {selectedEntry ? (
            <>
              {!editingShape && !editShapeRequest && backButton}
              {renderDetail(selectedEntry)}
            </>
          ) : (
            <div className="hidden lg:block">{detailEmptyState}</div>
          )}
        </div>
      </div>
    </div>
  )
}
