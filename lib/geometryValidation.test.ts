import { describe, it, expect } from 'vitest'
import type { Feature, Polygon } from 'geojson'
import {
  validatePolygonGeometry,
  MAX_BLOCK_AREA_KM2,
  MAX_PARCEL_AREA_KM2,
} from './geometryValidation'

function polygon(ring: [number, number][]): Feature<Polygon> {
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
}

// ~110m x ~80m in Minneapolis — a plausible single parcel, well under the parcel cap.
const parcelSized = polygon([
  [-93.25, 44.96],
  [-93.25, 44.9608],
  [-93.2489, 44.9608],
  [-93.2489, 44.96],
  [-93.25, 44.96],
])

// 1° x 1° — thousands of km², far over any cap.
const citySized = polygon([
  [-93, 44],
  [-93, 45],
  [-92, 45],
  [-92, 44],
  [-93, 44],
])

// Self-intersecting "bowtie": the ring crosses itself.
const bowtie = polygon([
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
  [0, 0],
])

describe('validatePolygonGeometry', () => {
  it('accepts a well-formed polygon under the cap', () => {
    expect(validatePolygonGeometry(parcelSized, MAX_PARCEL_AREA_KM2)).toEqual({ ok: true })
    expect(validatePolygonGeometry(parcelSized, MAX_BLOCK_AREA_KM2)).toEqual({ ok: true })
  })

  it('rejects a polygon larger than the supplied cap', () => {
    const result = validatePolygonGeometry(citySized, MAX_BLOCK_AREA_KM2)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/too large/i)
  })

  it('rejects a self-intersecting polygon (which can under-report its area)', () => {
    const result = validatePolygonGeometry(bowtie, MAX_BLOCK_AREA_KM2)
    expect(result.ok).toBe(false)
  })

  it('applies the caller-supplied cap, not a fixed one', () => {
    // The same parcel-sized shape passes the block cap but fails an absurdly tiny cap.
    expect(validatePolygonGeometry(parcelSized, 0.000001).ok).toBe(false)
  })
})
