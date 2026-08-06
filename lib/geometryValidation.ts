import { area, booleanValid, kinks } from '@turf/turf'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

/**
 * Polygon geometry validation for both block boundaries and individual address/parcel
 * shapes. Ported from geographic-community-webapp/lib/geometryValidation.ts, generalized
 * with a caller-supplied area cap since a block boundary and a single parcel operate at
 * very different scales — use the exported presets below rather than picking a number.
 */

// A block boundary: generous enough for any real neighborhood block, small enough to
// catch "drew the wrong thing" mistakes (e.g. an entire zip code).
export const MAX_BLOCK_AREA_KM2 = 2
// A single address/parcel: should never be more than a fraction of a block.
export const MAX_PARCEL_AREA_KM2 = 0.05

export type PolygonValidationResult = { ok: true } | { ok: false; error: string }

export function validatePolygonGeometry(
  feature: Feature<Polygon | MultiPolygon>,
  maxAreaKm2: number
): PolygonValidationResult {
  if (!booleanValid(feature)) {
    return { ok: false, error: 'The polygon geometry is invalid. Please redraw.' }
  }
  // booleanValid doesn't catch self-intersecting rings (e.g. a "bowtie") — turf's area()
  // is unreliable on those (signed-area terms from crossing lobes can cancel out, so a
  // shape spanning a much larger area than intended can compute as ~0 km² and slip past
  // the cap below). kinks() finds actual edge-crossing points, which is the check that's
  // actually needed here. (Ported from the geographic-community-webapp fix for the same bug.)
  if (kinks(feature).features.length > 0) {
    return { ok: false, error: 'The polygon geometry is invalid. Please redraw.' }
  }
  const areaSqKm = area(feature) / 1_000_000
  if (areaSqKm > maxAreaKm2) {
    return { ok: false, error: `Shape is too large (${areaSqKm.toFixed(3)} km²). Max is ${maxAreaKm2} km².` }
  }
  return { ok: true }
}
