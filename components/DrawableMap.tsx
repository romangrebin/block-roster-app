'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import MaplibreDraw from 'maplibre-gl-draw'
import 'maplibre-gl/dist/maplibre-gl.css'
import 'maplibre-gl-draw/dist/mapbox-gl-draw.css'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { BASEMAP_STYLE, boundsOf } from '@/lib/mapStyle'

/**
 * Draws or edits exactly one polygon — used for a community boundary and for individual parcel
 * shapes. Ported from geographic-community-webapp/components/Map.tsx, trimmed to just the map
 * init and draw wiring (no multi-feature browsing, hover states, etc. — not needed here).
 */

type DrawInstance = {
  add: (feature: Feature<Polygon | MultiPolygon>) => string[]
  changeMode: (mode: string, options?: Record<string, unknown>) => void
}

type DrawEvent = { features: Feature<Polygon | MultiPolygon>[] }
type Coordinates = [number, number]

type Props = {
  /** Existing polygon to load into edit mode. Omit to start a fresh draw. */
  initialGeojson?: Feature<Polygon | MultiPolygon> | null
  onChange: (feature: Feature<Polygon | MultiPolygon>) => void
  center?: Coordinates
  zoom?: number
  className?: string
  /**
   * The parent community's boundary, when drawing something *within* it (a residence's shape) —
   * not set when drawing the boundary itself, since it doesn't exist yet. Frames the initial
   * view around it instead of center/zoom. Deliberately doesn't hard-clamp panning to it — see
   * the maxBounds comment in createMap for why that backfires on an elongated community.
   */
  boundary?: Feature<Polygon | MultiPolygon> | null
}

const DEFAULT_CENTER: Coordinates = [-93.265, 44.9778] // Minneapolis; override per deployment
const DEFAULT_ZOOM = 16

function createMap(
  container: HTMLDivElement,
  center: Coordinates,
  zoom: number,
  boundary: Feature<Polygon | MultiPolygon> | null,
  initialGeojson: Feature<Polygon | MultiPolygon> | null
) {
  // Editing an existing shape: frame tightly on *that* shape, not the whole community boundary
  // (a residence can be anywhere in it — Roman's report: opening one to edit always centered on
  // the community, not the residence). Drawing a fresh one still frames the community, since
  // there's nothing else yet to center on.
  const bounds = initialGeojson ? boundsOf(initialGeojson, 0.01) : boundary ? boundsOf(boundary) : undefined
  // No maxBounds: it requires the *viewport* (this container's aspect ratio) to fit inside the
  // bounds box on every axis, so a community much taller/wider than the container forces a far
  // higher zoom than "frame the whole thing" needs, hiding most of the long axis — a real bug
  // Roman hit on a north-south block in a wide card. bounds/fitBoundsOptions alone still opens
  // on a sensible view; free pan/zoom afterward beats being unable to reach part of the map.
  const map = new maplibregl.Map({
    container,
    style: BASEMAP_STYLE,
    // maxPitch: 0 blocks 3D tilt from any input method (trackpad two-finger drag, keyboard,
    // touch) while leaving bearing rotation free — a stray gesture can no longer strand the map
    // at some tilted angle with no obvious way back.
    maxPitch: 0,
    ...(bounds ? { bounds, fitBoundsOptions: { padding: 30 } } : { center, zoom }),
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
  return map
}

function addDrawControl(
  map: maplibregl.Map,
  initialGeojson: Feature<Polygon | MultiPolygon> | null,
  onChange: (feature: Feature<Polygon | MultiPolygon>) => void
): void {
  // Always show both controls, in edit mode too — otherwise exiting draw mode (Escape, a stray
  // click, whatever) leaves no way back in except canceling the whole flow and starting over.
  const draw = new MaplibreDraw({
    displayControlsDefault: false,
    controls: { trash: true, polygon: true },
  }) as unknown as DrawInstance
  map.addControl(draw as unknown as maplibregl.IControl, 'top-left')

  if (initialGeojson) {
    const [featureId] = draw.add(initialGeojson)
    if (featureId) draw.changeMode('direct_select', { featureId })
  } else {
    draw.changeMode('draw_polygon')
  }

  map.on('draw.create', (e: DrawEvent) => {
    const feature = e.features[0]
    if (!feature) return
    // Switching mode synchronously inside this handler re-triggers draw.create and recurses,
    // hence the next-tick defer.
    setTimeout(() => draw.changeMode('direct_select', { featureId: feature.id as string }), 0)
    onChange(feature)
  })

  map.on('draw.update', (e: DrawEvent) => {
    const feature = e.features[0]
    if (feature) onChange(feature)
  })
}

// Nominatim (OpenStreetMap's free geocoder) — no API key, fits the CARTO/OSM basemap already
// in use. Fine for this app's low volume; a heavier-traffic deployment should proxy through a
// server route with a proper User-Agent per Nominatim's usage policy.
async function geocodeAddress(query: string): Promise<Coordinates | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
  const response = await fetch(url)
  const results: { lon: string; lat: string }[] = await response.json()
  const match = results[0]
  return match ? [parseFloat(match.lon), parseFloat(match.lat)] : null
}

function LocationSearch({ onFound }: { onFound: (coords: Coordinates) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'idle' | 'searching' | 'not-found'>('idle')

  // Not a <form> — DrawableMap can be embedded inside a page's own form (see
  // CreateBlockForm), and HTML forbids nesting <form> elements.
  const search = async () => {
    if (!query.trim()) return
    setStatus('searching')
    const coords = await geocodeAddress(query.trim())
    if (!coords) {
      setStatus('not-found')
      return
    }
    setStatus('idle')
    onFound(coords)
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-11/12 max-w-sm">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setStatus('idle')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            search()
          }
        }}
        placeholder="Search for an address or place…"
        className="w-full border border-border rounded-xl px-4 py-2.5 text-base bg-surface shadow-md focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {status === 'searching' && (
        <p className="mt-1 inline-block bg-surface rounded-md px-2 py-1 text-sm text-muted shadow-md">
          Searching…
        </p>
      )}
      {status === 'not-found' && (
        <p className="mt-1 inline-block bg-surface rounded-md px-2 py-1 text-sm text-red-600 shadow-md">
          Nothing found for that search.
        </p>
      )}
    </div>
  )
}

export default function DrawableMap({
  initialGeojson = null,
  onChange,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  className = '',
  boundary = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null)
  // Drives the "how to draw" hint below — irrelevant once there's already a shape (editing an
  // existing one) or once the first point has landed, so it only shows for a genuinely blank draw.
  const [hasShape, setHasShape] = useState(!!initialGeojson)

  useEffect(() => {
    if (!containerRef.current) return

    const map = createMap(containerRef.current, center, zoom, boundary, initialGeojson)
    let unmounted = false

    map.once('load', () => {
      if (unmounted) return
      mapRef.current = map
      addDrawControl(map, initialGeojson, (feature) => {
        setHasShape(true)
        onChange(feature)
      })
    })

    // map.remove() alone tears down every control and listener registered on the map (it loops
    // its own controls calling onRemove() before destroying internal state), so that's the only
    // call needed here — see maplibre-gl's Map.remove() source.
    return () => {
      unmounted = true
      mapRef.current = null
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      <LocationSearch
        onFound={(coords) => {
          const map = mapRef.current
          if (!map) return
          map.flyTo({ center: coords, zoom: 17 })
          // A steward drawing a boundary should be able to see exactly where the search landed
          // before committing to it — drop a plain marker rather than nothing, replacing any
          // previous one so repeated searches don't leave a trail of markers behind.
          searchMarkerRef.current?.remove()
          searchMarkerRef.current = new maplibregl.Marker().setLngLat(coords).addTo(map)
        }}
      />
      {!hasShape && (
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-surface rounded-full px-4 py-2 text-sm text-muted shadow-md text-center">
          Click to add points, then click the first point again to close the shape.
        </p>
      )}
    </div>
  )
}
