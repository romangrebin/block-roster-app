'use client'

import { useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import {
  fitText,
  householdNames,
  placeHouses,
  spreadLabels,
  type Box,
  type PlacedHouse,
  type PrintEntry,
  type PrintResident,
} from '@/lib/printSheet'

type LayoutKey = 'map-and-directory' | 'names-on-map' | 'fill-in'
type VersionKey = 'filled' | 'blank'

const LAYOUT_OPTIONS: { key: LayoutKey; label: string; description: string }[] = [
  {
    key: 'map-and-directory',
    label: 'Map + directory',
    description: 'A numbered map with names down both sides, plus a second page for contact info and more about each household.',
  },
  {
    key: 'names-on-map',
    label: 'Names on the map',
    description: 'Names printed right beside each house, plus a second page for contact info and more about each household.',
  },
  {
    key: 'fill-in',
    label: 'Fill-in sheet',
    description: 'One page with a few lines beside each house, roomy enough to write in names and numbers by hand.',
  },
]

const VERSION_OPTIONS: { key: VersionKey; label: string }[] = [
  { key: 'filled', label: 'Filled in' },
  { key: 'blank', label: 'Blank' },
]

// The map page is one SVG in points (72 per inch): a US letter page minus 0.5in margins (see @page in globals.css).
const PAGE_WIDTH = 540
const PAGE_HEIGHT = 708
const CONTENT_TOP = 42
const CONTENT_BOTTOM = PAGE_HEIGHT - 6
const COLUMN_WIDTH = 150

const COLUMNS = {
  left: { x: 0, innerEdge: COLUMN_WIDTH },
  right: { x: PAGE_WIDTH - COLUMN_WIDTH, innerEdge: PAGE_WIDTH - COLUMN_WIDTH },
}

const MAP_BOXES: Record<LayoutKey, Box> = {
  'map-and-directory': { x: 166, y: CONTENT_TOP, width: 208, height: CONTENT_BOTTOM - CONTENT_TOP },
  'names-on-map': { x: 140, y: CONTENT_TOP, width: 260, height: CONTENT_BOTTOM - CONTENT_TOP },
  'fill-in': { x: 166, y: CONTENT_TOP, width: 208, height: CONTENT_BOTTOM - CONTENT_TOP },
}

const PREFERRED_LABEL_HEIGHT: Record<LayoutKey, number> = {
  'map-and-directory': 26,
  'names-on-map': 24,
  'fill-in': 42,
}

const INK = '#231f1a'
const MUTED = '#6b6459'
const RULE = '#c4c4c4'
const SANS = 'var(--font-manrope), Arial, sans-serif'
const SERIF = 'var(--font-lora), Georgia, serif'

const subscribeToNothing = () => () => {}

/** Today in the viewer's own time zone, not the server's. Empty during server rendering. */
function useTodayOnClient(): string {
  return useSyncExternalStore(
    subscribeToNothing,
    () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    () => ''
  )
}

export default function PrintSheets({
  blockName,
  entries,
  blankOnly = false,
}: {
  blockName: string
  entries: PrintEntry[]
  blankOnly?: boolean
}) {
  const [layout, setLayout] = useState<LayoutKey>('map-and-directory')
  const [version, setVersion] = useState<VersionKey>(blankOnly ? 'blank' : 'filled')
  const filled = version === 'filled'
  const today = useTodayOnClient()
  const asOf = today ? `As of ${today}` : ''
  const houses = placeHouses(entries, MAP_BOXES[layout])
  const hasDirectoryPage = layout !== 'fill-in'

  return (
    <div className="space-y-6">
      <div className="space-y-4 print:hidden">
        <p className="text-base text-muted">
          {blankOnly
            ? 'A blank paper copy of the community, to fill in by hand as you meet your neighbors.'
            : 'A paper copy of the community. Print it filled in with what neighbors have shared here, or blank to fill in yourself.'}{' '}
          For a PDF, choose “Save as PDF” in the print window.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ChoiceGroup options={LAYOUT_OPTIONS} value={layout} onChange={setLayout} />
          {!blankOnly && <ChoiceGroup options={VERSION_OPTIONS} value={version} onChange={setVersion} />}
          <button
            type="button"
            onClick={() => window.print()}
            data-umami-event="print-sheet"
            data-umami-event-layout={layout}
            data-umami-event-version={version}
            className="text-sm px-5 py-2 rounded-full bg-accent text-white hover:bg-accent-dark transition-colors cursor-pointer font-medium"
          >
            Print
          </button>
        </div>
        <p className="text-base text-ink">{LAYOUT_OPTIONS.find((option) => option.key === layout)?.description}</p>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <div className="w-[8.5in] mx-auto space-y-6 print:w-auto print:space-y-0">
          <Paper className={hasDirectoryPage ? 'break-after-page' : ''}>
            <MapPage layout={layout} filled={filled} blockName={blockName} asOf={asOf} houses={houses} />
          </Paper>
          {hasDirectoryPage && (
            <Paper>
              <DirectoryPage
                blockName={blockName}
                asOf={asOf}
                entries={entries}
                houses={houses}
                filled={filled}
                showNumbers={layout === 'map-and-directory'}
              />
            </Paper>
          )}
        </div>
      </div>
    </div>
  )
}

function ChoiceGroup<Key extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: Key; label: string }[]
  value: Key
  onChange: (key: Key) => void
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-1">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`text-sm px-3 py-1 rounded-full font-medium cursor-pointer transition-colors ${
            value === option.key ? 'bg-accent-soft text-accent-soft-ink' : 'text-muted hover:text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Paper({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-border shadow-sm p-[0.5in] print:border-0 print:shadow-none print:p-0 ${className}`}
    >
      {children}
    </div>
  )
}

function MapPage({
  layout,
  filled,
  blockName,
  asOf,
  houses,
}: {
  layout: LayoutKey
  filled: boolean
  blockName: string
  asOf: string
  houses: PlacedHouse[]
}) {
  return (
    <svg
      viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
      width="7.5in"
      height={`${PAGE_HEIGHT / 72}in`}
      className="block"
      style={{ fontFamily: SANS }}
    >
      <text x={0} y={18} fontSize={16} fill={INK} style={{ fontFamily: SERIF }}>
        {blockName}
      </text>
      <text x={PAGE_WIDTH} y={18} fontSize={8} fill={MUTED} textAnchor="end">
        {asOf}
      </text>
      <line x1={0} x2={PAGE_WIDTH} y1={28} y2={28} stroke={RULE} strokeWidth={0.5} />

      {houses.map((house) => (
        <path
          key={house.entry.residenceId}
          d={house.path}
          fill="#dcdcdc"
          stroke="#8f8f8f"
          strokeWidth={0.75}
          fillRule="evenodd"
        />
      ))}
      {layout === 'map-and-directory' &&
        houses.map((house) => (
          <text
            key={house.entry.residenceId}
            x={house.center.x}
            y={house.center.y}
            fontSize={6.5}
            fontWeight={600}
            fill={INK}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {house.number}
          </text>
        ))}

      <SideLabels layout={layout} filled={filled} houses={houses.filter((house) => house.side === 'left')} />
      <SideLabels layout={layout} filled={filled} houses={houses.filter((house) => house.side === 'right')} />
    </svg>
  )
}

type LabelProps = { house: PlacedHouse; top: number; height: number; filled: boolean }

const LABELS: Record<LayoutKey, (props: LabelProps) => ReactNode> = {
  'map-and-directory': NumberedLabel,
  'names-on-map': LabelBesideHouse,
  'fill-in': FillInLabel,
}

/** One side's labels, each placed as close to level with its house as the others allow. */
function SideLabels({ layout, filled, houses }: { layout: LayoutKey; filled: boolean; houses: PlacedHouse[] }) {
  if (houses.length === 0) return null
  const height = Math.min(PREFERRED_LABEL_HEIGHT[layout], (CONTENT_BOTTOM - CONTENT_TOP) / houses.length)
  const tops = spreadLabels(
    houses.map((house) => house.center.y - height / 2),
    height,
    CONTENT_TOP,
    CONTENT_BOTTOM
  )
  const Label = LABELS[layout]
  return (
    <>
      {houses.map((house, index) => (
        <Label key={house.entry.residenceId} house={house} top={tops[index]} height={height} filled={filled} />
      ))}
    </>
  )
}

function NumberedLabel({ house, top, height, filled }: LabelProps) {
  const column = COLUMNS[house.side]
  const writingLineY = top + height - 3
  return (
    <g>
      <circle cx={column.x + 5} cy={top + 5.5} r={5} fill="none" stroke={INK} strokeWidth={0.6} />
      <text
        x={column.x + 5}
        y={top + 5.5}
        fontSize={6}
        fontWeight={700}
        fill={INK}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {house.number}
      </text>
      <text x={column.x + 14} y={top + 8} fontSize={7} fill={MUTED}>
        {fitText(house.entry.label, COLUMN_WIDTH - 14, 7)}
      </text>
      {filled && (
        <text x={column.x} y={writingLineY - 2} fontSize={9} fontWeight={600} fill={INK}>
          {fitText(householdNames(house.entry.residents), COLUMN_WIDTH, 9)}
        </text>
      )}
      <line x1={column.x} x2={column.x + COLUMN_WIDTH} y1={writingLineY} y2={writingLineY} stroke={RULE} strokeWidth={0.5} />
    </g>
  )
}

function LabelBesideHouse({ house, top, height, filled }: LabelProps) {
  const isLeft = house.side === 'left'
  const houseEdge = isLeft ? house.leftEdge : house.rightEdge
  const textX = isLeft ? houseEdge - 6 : houseEdge + 6
  const roomForText = isLeft ? textX : PAGE_WIDTH - textX
  const textAnchor = isLeft ? 'end' : 'start'
  const names = householdNames(house.entry.residents)
  const blankLineLength = Math.min(80, roomForText)
  return (
    <g>
      <line
        x1={houseEdge}
        y1={house.center.y}
        x2={textX + (isLeft ? 2 : -2)}
        y2={top + height / 2}
        stroke={RULE}
        strokeWidth={0.5}
      />
      <text x={textX} y={top + 8} fontSize={7} fill={MUTED} textAnchor={textAnchor}>
        {fitText(house.entry.label, roomForText, 7)}
      </text>
      {filled && names ? (
        <text x={textX} y={top + 18} fontSize={9} fontWeight={600} fill={INK} textAnchor={textAnchor}>
          {fitText(names, roomForText, 9)}
        </text>
      ) : (
        <line
          x1={textX}
          x2={isLeft ? textX - blankLineLength : textX + blankLineLength}
          y1={top + 19}
          y2={top + 19}
          stroke={RULE}
          strokeWidth={0.5}
        />
      )}
    </g>
  )
}

function FillInLabel({ house, top, height, filled }: LabelProps) {
  const column = COLUMNS[house.side]
  const writingLineCount = Math.max(1, Math.min(3, Math.floor((height - 9) / 11)))
  const residents = house.entry.residents
  const printedLines = filled
    ? [householdNames(residents), residents.flatMap((resident) => resident.phone ?? []).join(' · ')]
    : []
  const houseEdge = house.side === 'left' ? house.leftEdge : house.rightEdge
  return (
    <g>
      <line x1={column.innerEdge} y1={top + 5} x2={houseEdge} y2={house.center.y} stroke={RULE} strokeWidth={0.5} strokeDasharray="1 2" />
      <text x={column.x} y={top + 7} fontSize={7} fontWeight={600} fill={MUTED}>
        {fitText(house.entry.label, COLUMN_WIDTH, 7)}
      </text>
      {Array.from({ length: writingLineCount }, (_, index) => {
        const lineY = top + 9 + (index + 1) * 11
        return (
          <g key={index}>
            {printedLines[index] && (
              <text x={column.x} y={lineY - 2} fontSize={8.5} fill={INK}>
                {fitText(printedLines[index], COLUMN_WIDTH, 8.5)}
              </text>
            )}
            <line x1={column.x} x2={column.x + COLUMN_WIDTH} y1={lineY} y2={lineY} stroke={RULE} strokeWidth={0.5} />
          </g>
        )
      })}
    </g>
  )
}

function DirectoryPage({
  blockName,
  asOf,
  entries,
  houses,
  filled,
  showNumbers,
}: {
  blockName: string
  asOf: string
  entries: PrintEntry[]
  houses: PlacedHouse[]
  filled: boolean
  showNumbers: boolean
}) {
  const mappedIds = new Set(houses.map((house) => house.entry.residenceId))
  const unmappedEntries = entries.filter((entry) => !mappedIds.has(entry.residenceId))
  const rows = [
    ...houses.map((house) => ({ number: house.number, entry: house.entry })),
    ...unmappedEntries.map((entry, index) => ({ number: houses.length + index + 1, entry })),
  ]

  return (
    <div className="min-h-[9.8in] print:min-h-0 text-[8.5pt] leading-snug text-ink">
      <div className="flex items-baseline justify-between border-b border-[#c4c4c4] pb-2 mb-3">
        <h2 className="text-[14pt]">{blockName}: who&apos;s who</h2>
        <span className="text-[8pt] text-muted">
          {asOf}
        </span>
      </div>
      <div className="columns-2 gap-8">
        {rows.map(({ number, entry }) => (
          <div key={entry.residenceId} className="break-inside-avoid mb-3">
            <p className="flex items-center gap-1.5 text-[7.5pt] font-semibold text-muted">
              {showNumbers && (
                <span className="inline-flex items-center justify-center w-[11pt] h-[11pt] rounded-full border border-ink text-ink text-[6pt] font-bold">
                  {number}
                </span>
              )}
              {entry.label}
            </p>
            {filled && entry.residents.length > 0 ? (
              entry.residents.map((resident, index) => <ResidentDetails key={index} resident={resident} />)
            ) : (
              <BlankLines count={3} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ResidentDetails({ resident }: { resident: PrintResident }) {
  const contactLine = [resident.phone, resident.email].filter(Boolean).join(' · ')
  return (
    <div className="mt-0.5">
      <p className="font-semibold">{resident.name}</p>
      {contactLine && <p>{contactLine}</p>}
      {resident.blurb && <p className="text-muted">{resident.blurb}</p>}
      {resident.details.map((detail) => (
        <p key={detail} className="text-muted">
          {detail}
        </p>
      ))}
    </div>
  )
}

function BlankLines({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="h-[14pt] border-b border-[#c4c4c4]" />
      ))}
    </>
  )
}
