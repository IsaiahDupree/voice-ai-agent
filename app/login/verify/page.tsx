'use client'

/**
 * /login/verify — exchanges the magic-link token for a session cookie.
 *
 * The user clicks the link in their email which lands here with
 * ?token=... . We hit /api/auth/login/verify (which sets the
 * auth_token httpOnly cookie) then redirect into nextUrl.
 *
 * On any failure mode show a recoverable error with a "request a new
 * link" CTA — never silently strand the user.
 */

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type State =
  | { phase: 'verifying' }
  | { phase: 'ok'; nextUrl: string }
  | { phase: 'error'; reason: 'invalid' | 'expired' | 'already_used' | 'unknown' }

export default function LoginVerifyPage() {
  const params = useSearchParams()
  const router = useRouter()
  const [state, setState] = useState<State>({ phase: 'verifying' })

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setState({ phase: 'error', reason: 'invalid' })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/auth/login/verify?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok || !data.ok) {
          const reason = (data.reason as 'invalid' | 'expired' | 'already_used' | undefined) ?? 'unknown'
          setState({ phase: 'error', reason })
          return
        }
        setState({ phase: 'ok', nextUrl: data.nextUrl ?? '/dashboard/agency' })
        // Brief hold so the user sees the success state, then redirect.
        setTimeout(() => router.push(data.nextUrl ?? '/dashboard/agency'), 300)
      } catch {
        if (!cancelled) setState({ phase: 'error', reason: 'unknown' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params, router])

  return (
    <div className="max-w-md mx-auto p-6 mt-16 space-y-4 text-center">
      {state.phase === 'verifying' && (
        <>
          <h1 className="text-xl font-semibold">Signing you in…</h1>
          <div className="h-1 w-full bg-gray-100 rounded overflow-hidden">
            <div className="h-1 bg-blue-600 animate-pulse w-1/3" />
          </div>
        </>
      )}
      {state.phase === 'ok' && (
        <>
          <h1 className="text-xl font-semibold">Signed in.</h1>
          <p className="text-sm text-gray-500">Redirecting…</p>
        </>
      )}
      {state.phase === 'error' && (
        <>
          <h1 className="text-xl font-semibold">Sign-in failed</h1>
          <p className="text-sm text-gray-600">{reasonText(state.reason)}</p>
          <a
            href="/login"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium"
          >
            Request a new link
          </a>
        </>
      )}
    </div>
  )
}

function reasonText(reason: 'invalid' | 'expired' | 'already_used' | 'unknown'): string {
  switch (reason) {
    case 'expired':
      return 'That link has expired. Magic links last 15 minutes.'
    case 'already_used':
      return 'That link has already been used. Each link works once.'
    case 'invalid':
      return 'That link is invalid. Maybe it was copied incompletely?'
    default:
      return 'Something went wrong. Try again.'
  }
}
