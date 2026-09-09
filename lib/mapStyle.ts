import * as turf from '@turf/turf'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

// CARTO started enforcing an API key on its public basemap CDN around Aug 2026 — a keyless
// request now gets a gray "API KEY REQUIRED" watermarked tile instead of an error, which is why
// this was easy to miss. Falls back to the keyless (watermarked) tile if the env var isn't set,
// rather than sending a literal "key=undefined". Same fix as geographic-community-webapp's
// notes/carto-basemap-apikey.md — key is `key=`, not `api_key=`, and the bare host (no
// a/b/c subdomain sharding, pointless over HTTP/2) is CARTO's current canonical form.
const cartoKeyParam = process.env.NEXT_PUBLIC_CARTO_API_KEY
  ? `?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY}`
  : ''

/** Shared CARTO/OSM raster basemap. Used by every map in the app. */
export const BASEMAP_STYLE = {
  version: 8 as const,
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  sources: {
    carto: {
      type: 'raster' as const,
      tiles: [`https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png${cartoKeyParam}`],
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'carto', type: 'raster' as const, source: 'carto' }],
}

// Shared between ResidencesOverviewMap's preview layer and SuggestedAddresses' row list, so a
// suggestion's checked/unchecked color reads the same whether you're looking at the map or the
// list — deliberately outside the green/gray/amber residence-status palette, since these aren't
// real residences yet. Checked (about to be added) is bolder than merely suggested.
export const PREVIEW_UNSELECTED = '#93c5fd'
export const PREVIEW_SELECTED = '#2563eb'

export function centroidOf(feature: Feature<Polygon | MultiPolygon>): [number, number] {
  return turf.centroid(feature).geometry.coordinates as [number, number]
}

/** A small buffer around a polygon's bbox — enough room to see its edges without free-roaming past them. */
export function boundsOf(
  feature: Feature<Polygon | MultiPolygon>,
  bufferKm = 0.03
): [number, number, number, number] {
  const buffered = turf.buffer(feature, bufferKm, { units: 'kilometers' })
  return turf.bbox(buffered ?? feature) as [number, number, number, number]
}
