'use client'

/**
 * /login/sent — confirmation that the magic link was emailed.
 *
 * Always shows the same message (no enumeration leak). The user clicks
 * the link in their email which lands at /login/verify.
 */

import { useSearchParams } from 'next/navigation'

export default function LoginSentPage() {
  const params = useSearchParams()
  const email = params.get('email') ?? 'your inbox'

  return (
    <div className="max-w-md mx-auto p-6 mt-16 space-y-5 text-center">
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p className="text-sm text-gray-600">
        If <span className="font-medium">{email}</span> has an account, we just sent a one-time
        sign-in link. It expires in 15 minutes.
      </p>
      <p className="text-xs text-gray-500">
        Didn't get it? Check spam, then{' '}
        <a href="/login" className="text-blue-600 hover:underline">
          try again
        </a>
        .
      </p>
    </div>
  )
}
