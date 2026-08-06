'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import 'maplibre-gl-draw/dist/mapbox-gl-draw.css'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

/**
 * A focused map for drawing or editing exactly ONE polygon at a time — used both for a
 * steward drawing the block boundary and for drawing/adjusting individual address parcels.
 *
 * Ported and trimmed down from geographic-community-webapp/components/Map.tsx, which is
 * built for browsing many communities at once (hover states, steward badges, click-to-select
 * across a shared source) — none of that applies here. What's preserved is the map init and
 * the maplibre-gl-draw wiring, including two details that were hard-won there:
 *   - draw.create must defer its changeMode call to the next tick, or it re-triggers
 *     draw.create synchronously and recurses.
 *   - the trash control is suppressed while editing an existing polygon, since deleting
 *     the only shape would leave the record with no boundary.
 *
 * NOT built yet: a "tap your pre-loaded parcel to select it" mode for resident intake —
 * that's a selection interaction over many existing features, a different shape of problem
 * than single-polygon draw/edit, and is separate follow-up work.
 */

type DrawInstance = {
  getAll: () => { features: unknown[] }
  add: (f: unknown) => string[]
  deleteAll: () => void
  changeMode: (mode: string, options?: Record<string, unknown>) => void
}

type Props = {
  /** Existing polygon to load into edit mode. Omit to start a fresh draw. */
  initialGeojson?: Feature<Polygon | MultiPolygon> | null
  onChange: (feature: Feature<Polygon | MultiPolygon>) => void
  center?: [number, number]
  zoom?: number
  className?: string
}

const DEFAULT_CENTER: [number, number] = [-93.265, 44.9778] // Minneapolis; override per deployment
const DEFAULT_ZOOM = 16

export default function DrawableMap({
  initialGeojson = null,
  onChange,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const drawRef = useRef<DrawInstance | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
        sources: {
          carto: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap © CARTO',
            maxzoom: 19,
          },
        },
        layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
      },
      center,
      zoom,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')

    map.on('load', () => {
      mapRef.current = map
      setMapReady(true)
    })

    return () => {
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Wire up the draw control once the map is ready
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MaplibreDraw = (require('maplibre-gl-draw').default ?? require('maplibre-gl-draw')) as {
      new (options: unknown): DrawInstance
    }
    const draw = new MaplibreDraw({
      displayControlsDefault: false,
      controls: initialGeojson ? {} : { trash: true },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.addControl(draw as any, 'top-left')
    drawRef.current = draw

    if (initialGeojson) {
      const ids = draw.add(initialGeojson)
      if (ids.length > 0) {
        draw.changeMode('direct_select', { featureId: ids[0] })
      }
    } else {
      draw.changeMode('draw_polygon')
    }

    const onCreate = (e: { features: unknown[] }) => {
      const feature = e.features[0] as Feature<Polygon | MultiPolygon>
      if (!feature) return
      // Deferred to next tick — calling changeMode synchronously inside a draw event
      // re-triggers draw.create and recurses. See geographic-community-webapp/components/Map.tsx.
      setTimeout(() => draw.changeMode('direct_select', { featureId: feature.id as string }), 0)
      onChange(feature)
    }
    const onUpdate = (e: { features: unknown[] }) => {
      const feature = e.features[0] as Feature<Polygon | MultiPolygon>
      if (feature) onChange(feature)
    }

    map.on('draw.create', onCreate)
    map.on('draw.update', onUpdate)

    return () => {
      map.off('draw.create', onCreate)
      map.off('draw.update', onUpdate)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.removeControl(draw as any)
      drawRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady])

  return <div ref={containerRef} className={`w-full h-full ${className}`} />
}
