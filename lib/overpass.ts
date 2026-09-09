import type { Feature, Polygon, MultiPolygon } from 'geojson'

/**
 * Suggests residence addresses (and, where OSM has real building geometry, a ready-to-use
 * shape) within a drawn boundary, via OSM's free Overpass API — no key, matches the rest of
 * the app's OSM-based stack (Nominatim search, CARTO basemap). Verified against a real
 * Minneapolis test boundary before building this: 27 addresses found, every one a closed `way`
 * with real polygon geometry (not just an address point). Purely a suggestion: failures should
 * degrade silently, never block adding residences (or drawing their shapes) the manual way.
 *
 * Tries two public mirrors in order — Roman hit several failures in a row against a single
 * mirror in practice (free/community-run instances are just flaky sometimes), so one retry
 * against a different host before actually giving up is worth the extra few seconds.
 */

const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

export type SuggestedAddress = {
  label: string
  /** Set only when OSM has the address tagged directly on a closed building way; null otherwise — still a valid suggestion, just without a ready-made shape. */
  shape: Feature<Polygon> | null
}

/** A shaped suggestion plus its checkbox state, mirrored from SuggestedAddresses up to ResidencesOverviewMap for previewing. */
export type SuggestionPreview = { label: string; shape: Feature<Polygon | MultiPolygon>; selected: boolean }

type OverpassElement = {
  type: 'way' | 'node'
  tags?: Record<string, string>
  geometry?: { lat: number; lon: number }[]
}

// Stripped off the end of a street name for both display and de-duplication — OSM data is
// inconsistently tagged in practice (the same real address might be "Longfellow Avenue South" on
// one element and "Longfellow Avenue" on another), and Roman asked for the shorter form anyway
// ("4504 Longfellow" rather than "4504 Longfellow Avenue South").
const DIRECTION_WORDS = new Set([
  'north',
  'south',
  'east',
  'west',
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
  'northeast',
  'northwest',
  'southeast',
  'southwest',
])
const STREET_TYPE_WORDS = new Set([
  'avenue',
  'ave',
  'street',
  'st',
  'road',
  'rd',
  'drive',
  'dr',
  'lane',
  'ln',
  'boulevard',
  'blvd',
  'court',
  'ct',
  'place',
  'pl',
  'way',
  'terrace',
  'ter',
  'circle',
  'cir',
  'parkway',
  'pkwy',
  'trail',
  'trl',
  'highway',
  'hwy',
  'square',
  'sq',
])

/** "4504 Longfellow Avenue South" -> "4504 Longfellow" — strips a trailing direction and/or
 * street-type word, but always keeps at least a house number plus one street-name word. */
export function normalizeAddressLabel(label: string): string {
  const words = label.trim().split(/\s+/)
  while (words.length > 2) {
    const last = words[words.length - 1].toLowerCase().replace(/\.$/, '')
    if (DIRECTION_WORDS.has(last) || STREET_TYPE_WORDS.has(last)) {
      words.pop()
    } else {
      break
    }
  }
  return words.join(' ')
}

function exteriorRing(boundary: Feature<Polygon | MultiPolygon>): [number, number][] {
  return boundary.geometry.type === 'Polygon'
    ? (boundary.geometry.coordinates[0] as [number, number][])
    : (boundary.geometry.coordinates[0][0] as [number, number][])
}

/** A way's OSM `out geom` node list, converted to a GeoJSON polygon — only if it's actually a closed ring. */
function wayToPolygon(geometry: { lat: number; lon: number }[]): Feature<Polygon> | null {
  if (geometry.length < 4) return null
  const first = geometry[0]
  const last = geometry[geometry.length - 1]
  if (first.lat !== last.lat || first.lon !== last.lon) return null
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [geometry.map((p) => [p.lon, p.lat])] },
  }
}

// Kept a bit above the query's own [timeout:20] so a slow-but-alive server has a chance to
// finish and respond before this gives up on it client-side — aborting first would waste the
// attempt for no reason.
const OVERPASS_TIMEOUT_MS = 25_000

async function queryOverpass(endpoint: string, query: string): Promise<{ elements?: OverpassElement[] }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Overpass request failed: ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

export async function suggestAddressesWithinBoundary(
  boundary: Feature<Polygon | MultiPolygon>
): Promise<SuggestedAddress[]> {
  const poly = exteriorRing(boundary)
    .map(([lon, lat]) => `${lat} ${lon}`)
    .join(' ')
  // out geom (not out center) — need each way's actual node ring to draw a shape, not just its centroid.
  const query = `[out:json][timeout:20];(way['addr:housenumber'](poly:'${poly}');node['addr:housenumber'](poly:'${poly}'););out geom;`

  let json: { elements?: OverpassElement[] } | null = null
  let lastError: unknown = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      json = await queryOverpass(endpoint, query)
      break
    } catch (err) {
      lastError = err
    }
  }
  if (!json) throw lastError ?? new Error('Overpass: all endpoints failed')

  const byLabel = new Map<string, SuggestedAddress>()
  for (const element of json.elements ?? []) {
    const houseNumber = element.tags?.['addr:housenumber']
    const street = element.tags?.['addr:street']
    if (!houseNumber || !street) continue
    const label = normalizeAddressLabel(`${houseNumber} ${street}`)
    if (byLabel.has(label)) continue // keep the first match if duplicated across elements — now also catches the same address tagged inconsistently ("Ave" vs "Avenue South") once normalized
    const shape = element.type === 'way' && element.geometry ? wayToPolygon(element.geometry) : null
    byLabel.set(label, { label, shape })
  }
  return [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label))
}
