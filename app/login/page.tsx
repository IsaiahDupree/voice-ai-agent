'use client'

/**
 * /login — request a magic link.
 *
 * Simple email form. On submit, POST /api/auth/login then redirect to
 * /login/sent. We always show the same success state regardless of
 * whether the email exists (the API hides it).
 */

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const nextUrl = params.get('next') ?? '/dashboard/agency'

  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) {
      setErr('Enter a valid email address.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), nextUrl }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErr(data.error ?? 'request failed')
        setBusy(false)
        return
      }
      router.push(`/login/sent?email=${encodeURIComponent(email.trim().toLowerCase())}`)
    } catch (e: any) {
      setErr(e?.message ?? 'request failed')
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 mt-16 space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-gray-600">
          We'll email you a one-time link. No password required.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          Email
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded text-sm"
            placeholder="you@agency.com"
            autoFocus
            required
          />
        </label>
        {err && <div className="p-2 bg-red-50 text-red-700 rounded text-sm">{err}</div>}
        <button
          type="submit"
          disabled={busy}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Email me a sign-in link →'}
        </button>
      </form>

      <p className="text-xs text-gray-500">
        New here?{' '}
        <a href="/signup" className="text-blue-600 hover:underline">
          Start an agency
        </a>
        .
      </p>
    </div>
  )
}
