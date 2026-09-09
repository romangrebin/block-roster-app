'use client'

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { BASEMAP_STYLE } from '@/lib/mapStyle'

export type ShapedResidence = { id: string; label: string; shape: Feature<Polygon | MultiPolygon> }

const DEFAULT_FILL = '#c2542e'
const SELECTED_FILL = '#7a3319'

/**
 * "Tap your house on a map" — a read-only click-to-select map of every residence that has a
 * drawn shape. Standing alongside the plain-list dropdown (ResidentIntakeForm), not replacing
 * it: not every residence has a shape yet, so the list stays the guaranteed fallback.
 */
export default function ResidenceMapPicker({
  residences,
  selectedId,
  onSelect,
}: {
  residences: ShapedResidence[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const onSelectRef = useRef(onSelect)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    if (!containerRef.current || residences.length === 0) return

    const featureCollection: FeatureCollection = {
      type: 'FeatureCollection',
      features: residences.map((r) => ({
        type: 'Feature',
        geometry: r.shape.geometry,
        properties: { residenceId: r.id },
      })),
    }
    const bounds = turf.bbox(featureCollection) as [number, number, number, number]

    // No maxBounds — see DrawableMap.tsx's createMap for why clamping panning to an elongated
    // community boundary inside a mismatched-aspect-ratio container backfires (forces a zoom
    // that hides most of the long axis). bounds still frames the initial view on the shapes.
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      bounds,
      fitBoundsOptions: { padding: 30 },
      maxPitch: 0,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    let unmounted = false

    map.once('load', () => {
      if (unmounted) return
      map.addSource('residences', { type: 'geojson', data: featureCollection })
      map.addLayer({
        id: 'residences-fill',
        type: 'fill',
        source: 'residences',
        paint: { 'fill-color': DEFAULT_FILL, 'fill-opacity': 0.35 },
      })
      map.addLayer({
        id: 'residences-outline',
        type: 'line',
        source: 'residences',
        paint: { 'line-color': DEFAULT_FILL, 'line-width': 2 },
      })
      map.on('click', 'residences-fill', (e) => {
        const residenceId = e.features?.[0]?.properties?.residenceId
        if (residenceId) onSelectRef.current(residenceId)
      })
      map.on('mouseenter', 'residences-fill', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'residences-fill', () => {
        map.getCanvas().style.cursor = ''
      })
      mapRef.current = map
    })

    return () => {
      unmounted = true
      mapRef.current = null
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-paint whichever shape is currently selected — separate from the mount effect since
  // selection changes on every click, long after the map/layers already exist.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('residences-fill')) return
    const colorByResidence = [
      'case',
      ['==', ['get', 'residenceId'], selectedId],
      SELECTED_FILL,
      DEFAULT_FILL,
    ]
    map.setPaintProperty('residences-fill', 'fill-color', colorByResidence)
    map.setPaintProperty('residences-outline', 'line-color', colorByResidence)
  }, [selectedId])

  return <div ref={containerRef} className="w-full h-full" />
}
