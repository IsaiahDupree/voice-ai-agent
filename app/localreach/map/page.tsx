'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface CoverageRing {
  id: string
  campaign_id: string
  campaign_name: string
  center_lat: number
  center_lng: number
  radius_miles: number
  status: 'complete' | 'in_progress' | 'pending'
  businesses_total: number
  businesses_called: number
}

interface BusinessPin {
  id: string
  name: string
  lat: number
  lng: number
  outcome: 'answered' | 'voicemail' | 'booked' | 'paid' | 'no_answer' | 'pending'
}

interface MapData {
  rings: CoverageRing[]
  businesses: BusinessPin[]
  center: { lat: number; lng: number }
  bounds: { min_lat: number; max_lat: number; min_lng: number; max_lng: number }
}

const RING_COLORS: Record<string, { stroke: string; fill: string }> = {
  complete:    { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.08)' },
  in_progress: { stroke: '#eab308', fill: 'rgba(234, 179, 8, 0.08)' },
  pending:     { stroke: '#9ca3af', fill: 'rgba(156, 163, 175, 0.06)' },
}

const PIN_COLORS: Record<string, string> = {
  answered:  '#22c55e',
  voicemail: '#3b82f6',
  booked:    '#a855f7',
  paid:      '#eab308',
  no_answer: '#9ca3af',
  pending:   '#d1d5db',
}

function latLngToSvg(
  lat: number,
  lng: number,
  bounds: MapData['bounds'],
  width: number,
  height: number,
  padding: number
): { x: number; y: number } {
  const lngRange = bounds.max_lng - bounds.min_lng || 1
  const latRange = bounds.max_lat - bounds.min_lat || 1
  const x = padding + ((lng - bounds.min_lng) / lngRange) * (width - 2 * padding)
  const y = padding + ((bounds.max_lat - lat) / latRange) * (height - 2 * padding)
  return { x, y }
}

function milesToSvgRadius(
  miles: number,
  latRange: number,
  height: number,
  padding: number
): number {
  const degreesPerMile = 1 / 69
  const degrees = miles * degreesPerMile
  return (degrees / (latRange || 1)) * (height - 2 * padding)
}

export default function MapPage() {
  const [mapData, setMapData] = useState<MapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [selectedRing, setSelectedRing] = useState<CoverageRing | null>(null)
  const [selectedPin, setSelectedPin] = useState<BusinessPin | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const lastTouch = useRef({ x: 0, y: 0 })
  const lastPinchDist = useRef(0)

  useEffect(() => {
    fetchMapData()
  }, [])

  async function fetchMapData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/localreach/map')
      if (!res.ok) throw new Error(`Failed to load map data: ${res.statusText}`)
      const data = await res.json()
      setMapData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load map')
    } finally {
      setLoading(false)
    }
  }

  // Touch handlers for pinch-to-zoom and panning
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()

    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - lastTouch.current.x
      const dy = e.touches[0].clientY - lastTouch.current.y
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
    }

    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (lastPinchDist.current > 0) {
        const factor = dist / lastPinchDist.current
        setScale((prev) => Math.min(5, Math.max(0.5, prev * factor)))
      }
      lastPinchDist.current = dist
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false
    lastPinchDist.current = 0
  }, [])

  // Wheel zoom for desktop
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setScale((prev) => Math.min(5, Math.max(0.5, prev * factor)))
  }, [])

  function resetView() {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
    setSelectedRing(null)
    setSelectedPin(null)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={fetchMapData}
          className="min-h-[44px] px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Coverage Map</h1>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 aspect-square sm:aspect-[4/3] flex items-center justify-center">
          <div className="text-center">
            <svg className="animate-spin h-8 w-8 text-green-600 mx-auto mb-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading map data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!mapData || (mapData.rings.length === 0 && mapData.businesses.length === 0)) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Coverage Map</h1>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 border border-gray-200 dark:border-gray-800 text-center">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 mb-4">No coverage data yet. Create a campaign to see the map.</p>
        </div>
      </div>
    )
  }

  const SVG_WIDTH = 600
  const SVG_HEIGHT = 500
  const PADDING = 60
  const bounds = mapData.bounds
  const latRange = bounds.max_lat - bounds.min_lat || 1

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Coverage Map</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setScale((s) => Math.min(5, s * 1.3))}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            aria-label="Zoom in"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => setScale((s) => Math.max(0.5, s * 0.7))}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            aria-label="Zoom out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={resetView}
            className="min-h-[44px] px-3 flex items-center rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-600 dark:text-gray-400">Complete</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-gray-600 dark:text-gray-400">In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gray-400" />
          <span className="text-gray-600 dark:text-gray-400">Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-gray-600 dark:text-gray-400">Booked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="text-gray-600 dark:text-gray-400">Paid</span>
        </div>
      </div>

      {/* Map Container */}
      <div
        ref={containerRef}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden touch-none"
        style={{ aspectRatio: `${SVG_WIDTH} / ${SVG_HEIGHT}` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-full"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging.current ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {/* Grid lines */}
          {Array.from({ length: 5 }).map((_, i) => {
            const x = PADDING + (i / 4) * (SVG_WIDTH - 2 * PADDING)
            const y = PADDING + (i / 4) * (SVG_HEIGHT - 2 * PADDING)
            return (
              <g key={i}>
                <line x1={x} y1={PADDING} x2={x} y2={SVG_HEIGHT - PADDING} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth={0.5} />
                <line x1={PADDING} y1={y} x2={SVG_WIDTH - PADDING} y2={y} className="stroke-gray-100 dark:stroke-gray-800" strokeWidth={0.5} />
              </g>
            )
          })}

          {/* Coverage Rings */}
          {mapData.rings.map((ring) => {
            const center = latLngToSvg(ring.center_lat, ring.center_lng, bounds, SVG_WIDTH, SVG_HEIGHT, PADDING)
            const r = milesToSvgRadius(ring.radius_miles, latRange, SVG_HEIGHT, PADDING)
            const colors = RING_COLORS[ring.status] ?? RING_COLORS.pending

            return (
              <g key={ring.id}>
                <circle
                  cx={center.x}
                  cy={center.y}
                  r={Math.max(r, 10)}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={2}
                  strokeDasharray={ring.status === 'pending' ? '6,4' : 'none'}
                  className="cursor-pointer"
                  onClick={() => setSelectedRing(ring)}
                />
                {/* Center marker */}
                <circle cx={center.x} cy={center.y} r={4} fill={colors.stroke} />
              </g>
            )
          })}

          {/* Business Pins */}
          {mapData.businesses.map((biz) => {
            const pos = latLngToSvg(biz.lat, biz.lng, bounds, SVG_WIDTH, SVG_HEIGHT, PADDING)
            const color = PIN_COLORS[biz.outcome] ?? PIN_COLORS.pending

            return (
              <circle
                key={biz.id}
                cx={pos.x}
                cy={pos.y}
                r={scale > 2 ? 4 : 3}
                fill={color}
                stroke="white"
                strokeWidth={1}
                className="cursor-pointer"
                onClick={() => setSelectedPin(biz)}
              />
            )
          })}
        </svg>
      </div>

      {/* Selected Ring Info */}
      {selectedRing && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{selectedRing.campaign_name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {selectedRing.radius_miles} mi radius
              </p>
            </div>
            <button
              onClick={() => setSelectedRing(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{selectedRing.businesses_called} / {selectedRing.businesses_total} businesses called</span>
              <span>{selectedRing.businesses_total > 0 ? Math.round((selectedRing.businesses_called / selectedRing.businesses_total) * 100) : 0}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  selectedRing.status === 'complete' ? 'bg-green-500' :
                  selectedRing.status === 'in_progress' ? 'bg-yellow-500' :
                  'bg-gray-400'
                }`}
                style={{ width: `${selectedRing.businesses_total > 0 ? (selectedRing.businesses_called / selectedRing.businesses_total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Selected Pin Info */}
      {selectedPin && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{selectedPin.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: PIN_COLORS[selectedPin.outcome] ?? PIN_COLORS.pending }}
                />
                <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {selectedPin.outcome.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                {selectedPin.lat.toFixed(4)}, {selectedPin.lng.toFixed(4)}
              </p>
            </div>
            <button
              onClick={() => setSelectedPin(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
