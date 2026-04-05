/**
 * Feature 213: GET /api/auth/google-calendar - OAuth redirect
 * Initiates Google Calendar OAuth flow by redirecting to Google's consent screen
 *
 * Flow:
 * 1. User visits this endpoint
 * 2. Redirects to Google OAuth with required scopes
 * 3. Google redirects back to /api/auth/google-calendar/callback
 *
 * Required env vars:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - NEXT_PUBLIC_APP_URL
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (!clientId) {
      return NextResponse.json(
        { error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID env var.' },
        { status: 500 }
      )
    }

    // Callback URL where Google will redirect after user grants permission
    const redirectUri = `${appUrl}/api/auth/google-calendar/callback`

    // Required scopes for Google Calendar access
    const scopes = [
      'https://www.googleapis.com/auth/calendar', // Full calendar access
      'https://www.googleapis.com/auth/calendar.events', // Create/edit events
      'https://www.googleapis.com/auth/userinfo.email', // User's email (for identification)
    ]

    // Optional: state parameter for CSRF protection
    // In production, generate random state, store in session/cookie, verify in callback
    const state = request.nextUrl.searchParams.get('state') || 'default_state'

    // Build Google OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scopes.join(' '))
    authUrl.searchParams.set('access_type', 'offline') // Request refresh token
    authUrl.searchParams.set('prompt', 'consent') // Force consent screen (ensures refresh_token)
    authUrl.searchParams.set('state', state)

    // Redirect to Google OAuth consent screen
    return NextResponse.redirect(authUrl.toString())
  } catch (error: any) {
    console.error('Google OAuth redirect failed:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Google OAuth flow', details: error.message },
      { status: 500 }
    )
  }
}
