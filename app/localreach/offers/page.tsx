'use client'

import { useEffect, useState } from 'react'

interface Offer {
  id: string
  name: string
  price: number
  discount_price?: number
  niche: string
  niche_tags: string[]
  elevator_pitch: string
  description: string
  created_at: string
}

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchOffers()
  }, [])

  async function fetchOffers() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/localreach/offers')
      if (!res.ok) throw new Error(`Failed to load offers: ${res.statusText}`)
      const data = await res.json()
      setOffers(Array.isArray(data) ? data : data.offers ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load offers')
    } finally {
      setLoading(false)
    }
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
          onClick={fetchOffers}
          className="min-h-[44px] px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Offer Library</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {offers.length} offer{offers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 animate-pulse">
              <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
              <div className="flex gap-2 mb-3">
                <div className="h-6 w-14 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
              </div>
              <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : offers.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 border border-gray-200 dark:border-gray-800 text-center">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">No offers available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer) => {
            const hasDiscount = offer.discount_price != null && offer.discount_price < offer.price
            const isExpanded = expandedId === offer.id

            return (
              <button
                key={offer.id}
                onClick={() => setExpandedId(isExpanded ? null : offer.id)}
                className="text-left bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 hover:border-green-300 dark:hover:border-green-700 transition-colors relative overflow-hidden"
              >
                {/* Discount badge */}
                {hasDiscount && (
                  <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                    {Math.round(((offer.price - offer.discount_price!) / offer.price) * 100)}% off
                  </div>
                )}

                <h3 className="font-semibold text-base pr-16 leading-tight">{offer.name}</h3>

                {/* Price */}
                <div className="mt-2 flex items-baseline gap-2">
                  {hasDiscount ? (
                    <>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        ${offer.discount_price!.toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-400 line-through">
                        ${offer.price.toLocaleString()}
                      </span>
                    </>
                  ) : (
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      ${offer.price.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Niche tags */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(offer.niche_tags && offer.niche_tags.length > 0 ? offer.niche_tags : [offer.niche]).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Elevator pitch */}
                <p className={`mt-3 text-sm text-gray-600 dark:text-gray-400 ${isExpanded ? '' : 'line-clamp-2'}`}>
                  {offer.elevator_pitch}
                </p>

                {/* Expanded description */}
                {isExpanded && offer.description && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-2">
                    {offer.description}
                  </p>
                )}

                <span className="mt-3 inline-block text-xs text-gray-400 dark:text-gray-600">
                  {isExpanded ? 'Tap to collapse' : 'Tap for details'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
