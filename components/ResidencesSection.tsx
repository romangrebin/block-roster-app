'use client'

import { useEffect, useState } from 'react'
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

/**
 * The residence list on /<code> — list view (the original, everything, including residences
 * without a shape) plus a map view (only residences with a drawn shape, color-coded by status —
 * the brief's "day one is a visible gap map," made literal). On wide screens there's room for
 * both at once, side by side (map wider than the list — Roman's call, plenty of width to spare);
 * below that breakpoint it's a List/Map toggle instead. Clicking a residence in either one
 * highlights it in the other (a bold outline on the map, a tinted row in the list) via shared
 * selection state here. A client component either way, since both the toggle and the selection
 * need interactivity the server-rendered page above it doesn't otherwise need.
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
   * row's nickname be edited even by a non-steward, without opening it up to every residence. */
  viewerResidenceId?: string | null
  previewSuggestions?: SuggestionPreview[]
  /** Bumped by AddResidenceTools' "draw it yourself" option — forces Map view so the draw tool is actually visible. */
  drawRequest?: number
  /** Forwarded from the map, further up to ResidencesWorkspace so it can disable "Add a residence" while a draw/edit is active. */
  onMapModeChange?: (mode: MapMode) => void
}) {
  const [view, setView] = useState<'list' | 'map'>('list')
  const [selectedResidenceId, setSelectedResidenceId] = useState<string | null>(null)
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

  const requestEditShape = (residenceId: string, shape: Feature<Polygon | MultiPolygon> | null) => {
    setEditShapeRequest({ nonce: Date.now(), residenceId, shape })
    setView('map')
  }

  const handleMapModeChange = (m: MapMode) => {
    setMapMode(m)
    onMapModeChange?.(m)
  }

  // True only for the one residence the map is actually mid-edit on right now — guards
  // ResidenceControls' Save/Cancel from sending a shape command that would land on some *other*
  // residence's in-progress edit if more than one row's rename input happened to be open.
  const isShapeEditActiveFor = (residenceId: string) =>
    mapMode === 'editing-existing' && editShapeRequest?.residenceId === residenceId

  const sendShapeEditCommand = (action: 'save' | 'cancel') => {
    setEditShapeCommand({ nonce: Date.now(), action })
  }

  // Below `lg`, Map is only visible when the toggle is set to it — a draw request from outside
  // (AddResidenceTools) needs to force that, or the draw tool would start on a hidden map.
  // Derived during render (comparing against a mirrored previous value) rather than in an Effect
  // — React's recommended way to react to a prop change without the extra render-after-commit
  // an Effect would cost here.
  const [lastDrawRequest, setLastDrawRequest] = useState(drawRequest)
  if (drawRequest !== lastDrawRequest) {
    setLastDrawRequest(drawRequest)
    setView('map')
  }

  // Selecting from the map should bring the matching row into view in the list — the list can
  // be much longer than what's visible at once, unlike the map's single highlighted shape.
  useEffect(() => {
    if (!selectedResidenceId) return
    document.getElementById(residenceRowId(selectedResidenceId))?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }, [selectedResidenceId])

  const selectResidence = (id: string) => {
    setSelectedResidenceId((prev) => (prev === id ? null : id))
  }

  const listContent =
    entries.length === 0 ? (
      <p className="text-base text-muted">
        {isSteward ? 'No residences yet — add some.' : 'No residences have been set up for this community yet.'}
      </p>
    ) : (
      <ul className="divide-y divide-border border border-border rounded-2xl bg-surface">
        {entries.map(({ residence, residents }) => (
          <li
            key={residence.id}
            id={residenceRowId(residence.id)}
            onClick={() => selectResidence(residence.id)}
            className={`px-5 py-2.5 space-y-2 cursor-pointer transition-colors ${
              residence.id === selectedResidenceId ? 'bg-accent-soft' : 'hover:bg-surface-muted'
            }`}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* The nickname (a resident-set friendlier name) is the primary heading whenever
                  it's set, with the official address-based label demoted to a smaller secondary
                  note — everyone sees this, not just whoever's editing. */}
              <span className="text-base font-medium text-ink break-words">
                {residence.nickname || residence.label}
                {residence.nickname && (
                  <span className="text-sm font-normal text-muted"> · {residence.label}</span>
                )}
              </span>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {/* At-a-glance shape status — Roman: the resident-status badge (Current/Vacant/
                    Unreached) is unnecessary noise, geo_map canvases only. */}
                {canvasType === 'geo_map' && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      residence.shape ? 'bg-blue-50 text-blue-700' : 'bg-surface-muted text-muted'
                    }`}
                  >
                    {residence.shape ? 'On map' : 'No shape'}
                  </span>
                )}
                {/* Resident details are hidden below unless this row is selected (they could get
                    long — a full blurb blew up a whole row's height) — this badge is the hint
                    that there's anyone registered here at all; the chevron (a standard
                    disclosure affordance, rotates on selection) is the hint that clicking
                    reveals more, not just a status readout. */}
                {residents.length > 0 && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-surface-muted text-muted">
                    {residents.length} resident{residents.length === 1 ? '' : 's'}
                    <svg
                      viewBox="0 0 12 12"
                      className={`w-3 h-3 transition-transform duration-200 ${
                        residence.id === selectedResidenceId ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 4.5L6 7.5L9 4.5" />
                    </svg>
                  </span>
                )}
                {isSteward && residence.id === selectedResidenceId && (
                  // stopPropagation — the whole row is also a click target (selects it), and
                  // without this, clicking Edit/Delete/Save/Cancel (or just clicking into the
                  // rename input) would immediately toggle selection back off, which — now that
                  // ResidenceControls only renders *because* this row is selected — would unmount
                  // it mid-click instead of just being a cosmetic highlight flicker like before.
                  <div onClick={(e) => e.stopPropagation()}>
                    <ResidenceControls
                      residenceId={residence.id}
                      label={residence.label}
                      residentCount={residents.length}
                      shape={residence.shape as Feature<Polygon | MultiPolygon> | null}
                      onEditShape={canvasType === 'geo_map' ? requestEditShape : undefined}
                      shapeEditActive={canvasType === 'geo_map' && isShapeEditActiveFor(residence.id)}
                      onShapeEditCommand={sendShapeEditCommand}
                    />
                  </div>
                )}
              </div>
            </div>
            {residence.id === selectedResidenceId && (isSteward || residence.id === viewerResidenceId) && (
              <div onClick={(e) => e.stopPropagation()}>
                <ResidenceNicknameEditor residenceId={residence.id} nickname={residence.nickname} />
              </div>
            )}
            {residents.length > 0 && residence.id === selectedResidenceId && (
              // stopPropagation for the same reason as ResidenceControls above — Approve/Promote/
              // Move-out are real buttons here (not local component state to lose), but without
              // this, clicking any of them would deselect the row and collapse this whole section
              // out from under the click.
              <ul className="space-y-2 pl-2" onClick={(e) => e.stopPropagation()}>
                {residents.map(({ resident, contacts }) => {
                  const email = contacts.find((c) => c.type === 'email')
                  const phone = contacts.find((c) => c.type === 'phone')
                  const isAlreadySteward = contacts.some((c) => c.userId && stewardUserIds.has(c.userId))
                  return (
                    <li key={resident.id} className="flex items-center justify-between gap-3 flex-wrap text-base">
                      <span className="text-ink break-words">
                        {resident.name}
                        {email && (
                          <span className="text-muted">
                            {' '}
                            — {email.value}
                            {isSteward && !email.verifiedAt && ' (unverified)'}
                          </span>
                        )}
                        {phone && <span className="text-muted"> · {phone.value}</span>}
                        {resident.blurb && (
                          <span className="block text-sm text-muted italic mt-0.5">{resident.blurb}</span>
                        )}
                      </span>
                      {isSteward && resident.status === 'pending' && email?.verifiedAt && (
                        <div className="flex items-center gap-2 shrink-0">
                          <ApproveResidentButton residentId={resident.id} />
                          <RemovePendingResidentButton residentId={resident.id} residentName={resident.name} />
                        </div>
                      )}
                      {isSteward && resident.status === 'pending' && !email?.verifiedAt && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm text-muted">awaiting verification</span>
                          <RemovePendingResidentButton residentId={resident.id} residentName={resident.name} />
                        </div>
                      )}
                      {isSteward && resident.status === 'approved' && (
                        <div className="flex items-center gap-2 shrink-0">
                          {isAlreadySteward ? (
                            <span className="text-sm text-accent font-medium">Steward</span>
                          ) : (
                            <PromoteToStewardButton residentId={resident.id} residentName={resident.name} />
                          )}
                          <MoveResidentOutButton residentId={resident.id} residentName={resident.name} />
                        </div>
                      )}
                      {isSteward && resident.status === 'moved_out' && (
                        <span className="text-sm text-muted shrink-0">moved out</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
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
          className={`h-96 lg:h-[28rem] rounded-2xl overflow-hidden border-2 transition-colors duration-300 ${
            mapMode === 'drawing-new' ? 'border-green-400' : 'border-border'
          }`}
        >
          <ResidencesOverviewMap
            entries={entries.map((e) => ({
              residence: e.residence,
              residentNames: e.residents.map((r) => r.resident.name),
            }))}
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-medium text-ink">Residences</h2>
        <div className="flex items-center gap-3">
          {canShowMap && (
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
          {showExportLink && (
            <a href={`/api/blocks/${blockId}/export`} className="text-sm text-accent hover:underline">
              Export CSV
            </a>
          )}
        </div>
      </div>

      {canShowMap ? (
        // Below lg: whichever the toggle picked, full width. At lg+: both at once, side by
        // side — the map gets the bigger share (Roman's call, there's width to spare on an
        // actual computer screen and the map benefits from it more than the list does). `1fr`/
        // `2fr` rather than a fixed `20rem` for the list — both columns should grow/shrink with
        // the viewport, not just the map, while keeping the map roughly twice as wide.
        <div className="lg:grid lg:grid-cols-[1fr_2fr] lg:gap-4 lg:items-start">
          <div className={view === 'map' ? 'hidden lg:block' : 'block'}>{listContent}</div>
          <div className={view === 'list' ? 'hidden lg:block' : 'block'}>{mapContent}</div>
        </div>
      ) : (
        listContent
      )}
    </div>
  )
}
