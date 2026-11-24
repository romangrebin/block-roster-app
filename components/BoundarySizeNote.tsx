import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { areaKm2, RECOMMENDED_BLOCK_AREA_KM2, type PolygonValidationResult } from '@/lib/geometryValidation'

/** Live feedback under a community-boundary map: invalid, bigger than recommended, or good. */
export default function BoundarySizeNote({
  boundary,
  check,
}: {
  boundary: Feature<Polygon | MultiPolygon>
  check: PolygonValidationResult
}) {
  if (!check.ok) return <p className="text-sm text-red-600 mt-2">{check.error}</p>
  if (areaKm2(boundary) > RECOMMENDED_BLOCK_AREA_KM2) {
    return (
      <p className="text-sm text-amber-700 mt-2">
        That covers more than a few blocks. Smaller is better, one block is ideal. You can still save it.
      </p>
    )
  }
  return <p className="text-sm text-accent mt-2">✓ Nice and small.</p>
}
