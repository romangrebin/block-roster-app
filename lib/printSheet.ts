import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'
import QRCode from 'qrcode'
import type { DirectoryEntry } from './application'

export type PrintResident = {
  name: string
  phone: string | null
  email: string | null
  blurb: string | null
  details: string[]
}

export type PrintEntry = {
  residenceId: string
  label: string
  residents: PrintResident[]
  // Each polygon is a list of rings, each ring a list of [lon, lat].
  polygons: Position[][][]
}

/**
 * Built from the peer-safe directory (approved residents, neighbor-visible contacts only) even
 * when a steward prints — paper gets passed around, so it carries only what every neighbor can
 * already see.
 */
export function buildPrintEntries(directory: DirectoryEntry[]): PrintEntry[] {
  return directory.map(({ residence, residents }) => ({
    residenceId: residence.id,
    label: residence.label,
    residents: residents.map(({ resident, contacts }) => ({
      name: resident.name,
      phone: contacts.find((contact) => contact.type === 'phone')?.value ?? null,
      email: contacts.find((contact) => contact.type === 'email')?.value ?? null,
      blurb: resident.blurb,
      details: [
        resident.movedInYear ? `Moved in ${resident.movedInYear}` : null,
        resident.favoriteSpot ? `Favorite spot: ${resident.favoriteSpot}` : null,
        resident.countMeInFor ? `Count me in for: ${resident.countMeInFor}` : null,
        resident.askMeAbout ? `Ask me about: ${resident.askMeAbout}` : null,
      ].filter((detail): detail is string => detail !== null),
    })),
    polygons: shapePolygons(residence.shape),
  }))
}

function shapePolygons(shape: unknown): Position[][][] {
  const geometry = (shape as Feature<Polygon | MultiPolygon> | null)?.geometry
  if (geometry?.type === 'Polygon') return [geometry.coordinates]
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates
  return []
}

/** "Roman & Emily": first names keep a whole household on one printed line. */
export function householdNames(residents: PrintResident[]): string {
  if (residents.length === 0) return ''
  if (residents.length === 1) return residents[0].name
  const firstNames = residents.map((resident) => resident.name.split(' ')[0])
  return `${firstNames.slice(0, -1).join(', ')} & ${firstNames[firstNames.length - 1]}`
}

const AVERAGE_CHAR_WIDTH_EM = 0.55

/** Cuts text that wouldn't fit in `maxWidth` (same units as fontSize) and adds an ellipsis. An estimate, not a measurement. */
export function fitText(text: string, maxWidth: number, fontSize: number): string {
  const maxChars = Math.floor(maxWidth / (fontSize * AVERAGE_CHAR_WIDTH_EM))
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(maxChars - 1, 0)).trimEnd()}…`
}

type Point = { x: number; y: number }
export type Box = { x: number; y: number; width: number; height: number }

export type PlacedHouse = {
  entry: PrintEntry
  number: number
  side: 'left' | 'right'
  path: string
  center: Point
  leftEdge: number
  rightEdge: number
}

/**
 * Fits every residence with a shape into `box`, turned so the block's long axis runs down the
 * (portrait) page. Houses are split into a left and right side and numbered down the left side,
 * then down the right. Returned in number order.
 */
export function placeHouses(entries: PrintEntry[], box: Box): PlacedHouse[] {
  const mappedEntries = entries.filter((entry) => entry.polygons.length > 0)
  if (mappedEntries.length === 0) return []

  const [referenceLon, referenceLat] = mappedEntries[0].polygons[0][0][0]
  const lonScale = Math.cos((referenceLat * Math.PI) / 180)
  // A flat plane with north up and y growing downward like the page; plenty accurate at block scale.
  const toPlane = ([lon, lat]: Position): Point => ({ x: (lon - referenceLon) * lonScale, y: referenceLat - lat })
  const planeHouses = mappedEntries.map((entry) => mapPoints(entry.polygons, toPlane))

  const rotate = rotationMakingLongAxisVertical(planeHouses.map((polygons) => averagePoint(polygons[0][0])))
  const rotatedHouses = planeHouses.map((polygons) => mapPoints(polygons, rotate))

  const allPoints = rotatedHouses.flat(3)
  const bounds = boundsOf(allPoints)
  const scale = Math.min(box.width / (bounds.maxX - bounds.minX), box.height / (bounds.maxY - bounds.minY))
  const offsetX = box.x + (box.width - (bounds.maxX - bounds.minX) * scale) / 2
  const offsetY = box.y + (box.height - (bounds.maxY - bounds.minY) * scale) / 2
  // Rounded because the server and the browser compute sin/cos differently in the last digits,
  // and the page renders on both: unrounded coordinates make React report a hydration mismatch.
  const toPage = (point: Point): Point => ({
    x: roundToHundredth(offsetX + (point.x - bounds.minX) * scale),
    y: roundToHundredth(offsetY + (point.y - bounds.minY) * scale),
  })

  const houses = rotatedHouses.map((rotatedPolygons, index) => {
    const pagePolygons = mapPoints(rotatedPolygons, toPage)
    const houseBounds = boundsOf(pagePolygons.flat(2))
    return {
      entry: mappedEntries[index],
      path: svgPath(pagePolygons),
      center: averagePoint(pagePolygons[0][0]),
      leftEdge: houseBounds.minX,
      rightEdge: houseBounds.maxX,
    }
  })

  const centerXs = houses.map((house) => house.center.x)
  const streetX = (Math.min(...centerXs) + Math.max(...centerXs)) / 2
  const byTopToBottom = (a: { center: Point }, b: { center: Point }) => a.center.y - b.center.y
  const leftSide = houses.filter((house) => house.center.x < streetX).sort(byTopToBottom)
  const rightSide = houses.filter((house) => house.center.x >= streetX).sort(byTopToBottom)

  return [
    ...leftSide.map((house) => ({ ...house, side: 'left' as const })),
    ...rightSide.map((house) => ({ ...house, side: 'right' as const })),
  ].map((house, index) => ({ ...house, number: index + 1 }))
}

/**
 * Tops for a column of equal-height labels: each as close as possible to where it wants to be
 * without overlapping its neighbors or leaving [top, bottom]. Expects desiredTops in ascending
 * order, and labelHeight small enough that all of them fit.
 */
export function spreadLabels(desiredTops: number[], labelHeight: number, top: number, bottom: number): number[] {
  const tops = [...desiredTops]
  for (let i = 0; i < tops.length; i++) {
    const lowestAllowed = i === 0 ? top : tops[i - 1] + labelHeight
    tops[i] = Math.max(tops[i], lowestAllowed)
  }
  for (let i = tops.length - 1; i >= 0; i--) {
    const highestAllowed = i === tops.length - 1 ? bottom - labelHeight : tops[i + 1] - labelHeight
    tops[i] = Math.min(tops[i], highestAllowed)
  }
  return tops
}

function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100
}

function mapPoints<From, To>(polygons: From[][][], transform: (point: From) => To): To[][][] {
  return polygons.map((rings) => rings.map((ring) => ring.map(transform)))
}

function averagePoint(points: Point[]): Point {
  const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}

function boundsOf(points: Point[]) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

/** Finds the direction the house centers spread out along most, and rotates that onto vertical. */
function rotationMakingLongAxisVertical(points: Point[]): (point: Point) => Point {
  const mean = averagePoint(points)
  let varianceX = 0
  let varianceY = 0
  let covariance = 0
  for (const point of points) {
    const dx = point.x - mean.x
    const dy = point.y - mean.y
    varianceX += dx * dx
    varianceY += dy * dy
    covariance += dx * dy
  }
  const longAxisAngle = Math.atan2(2 * covariance, varianceX - varianceY) / 2
  // Either of two opposite turns lines the axis up; take the smaller one so north stays roughly up.
  let turn = Math.PI / 2 - longAxisAngle
  if (turn > Math.PI / 2) turn -= Math.PI
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  return (point) => ({ x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos })
}

function svgPath(polygons: Point[][][]): string {
  return polygons
    .flat()
    .map((ring) => `M${ring.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join('L')}Z`)
    .join('')
}

// The site's permanent domain, not the current origin, so a sheet printed from a dev machine or a
// preview deploy still points somewhere that lasts.
const PRINT_SITE = 'ourblock.community'

/** What the QR code encodes: the redirect that survives a renamed community code. */
export function printQrUrl(printCode: string): string {
  return `https://${PRINT_SITE}/c/${printCode}`
}

/** The link printed under the QR code: the steward's memorable code, for typing by hand. */
export function printTextLink(code: string): string {
  return `${PRINT_SITE}/${code}`
}

/** A QR code as one SVG path, one unit per module. No quiet zone; leave blank space around it. */
export function qrCodePath(text: string): { path: string; size: number } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const squares: string[] = []
  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (modules.get(row, column)) squares.push(`M${column},${row}h1v1h-1z`)
    }
  }
  return { path: squares.join(''), size: modules.size }
}
