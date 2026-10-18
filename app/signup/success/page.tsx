'use client'

/**
 * /signup/success — Stripe redirects here after checkout.
 *
 * The webhook may not have fired yet (Stripe is "best-effort same
 * second" but not guaranteed). We poll /api/agencies/by-stripe-session
 * until the agency exists, then redirect into the dashboard.
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function SignupSuccessPage() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  const [status, setStatus] = useState<'waiting' | 'ready' | 'timeout'>('waiting')
  const [agencyId, setAgencyId] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    let mounted = true
    let attempts = 0
    const maxAttempts = 30 // ~30s of polling

    async function poll() {
      attempts++
      try {
        const res = await fetch(
          `/api/agencies/by-stripe-session?session_id=${encodeURIComponent(sessionId!)}`,
        )
        const data = await res.json()
        if (!mounted) return
        if (data.agency?.id) {
          setAgencyId(data.agency.id)
          setStatus('ready')
          return
        }
      } catch {
        /* keep polling */
      }
      if (attempts >= maxAttempts) {
        if (mounted) setStatus('timeout')
        return
      }
      setTimeout(poll, 1000)
    }
    poll()
    return () => {
      mounted = false
    }
  }, [sessionId])

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6 mt-12">
      <h1 className="text-2xl font-semibold">Payment confirmed</h1>

      {status === 'waiting' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Provisioning your agency… this usually takes a couple of seconds while Stripe
            confirms the subscription.
          </p>
          <div className="h-1 w-full bg-gray-100 rounded overflow-hidden">
            <div className="h-1 bg-blue-600 animate-pulse w-1/3" />
          </div>
        </div>
      )}

      {status === 'ready' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Your agency is ready. Head to your dashboard to add your first client.
          </p>
          <Link
            href={`/dashboard/agency?id=${encodeURIComponent(agencyId ?? '')}`}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium"
          >
            Open agency dashboard →
          </Link>
        </div>
      )}

      {status === 'timeout' && (
        <div className="space-y-3">
          <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded">
            Stripe confirmed the payment, but provisioning is taking longer than usual. Refresh
            this page in a minute, or contact support if it persists.
          </p>
        </div>
      )}
    </div>
  )
}
