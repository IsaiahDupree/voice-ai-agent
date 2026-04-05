/**
 * Feature 214: GET /api/auth/google-calendar/callback - OAuth callback
 * Receives authorization code from Google, exchanges for tokens, stores in Supabase
 *
 * Flow:
 * 1. Google redirects here with ?code=xxx after user grants permission
 * 2. Exchange code for access_token + refresh_token
 * 3. Get user info from Google (email, user ID)
 * 4. Store tokens in google_calendar_tokens table
 * 5. Redirect to dashboard with success message
 *
 * Required env vars:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - NEXT_PUBLIC_APP_URL
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    // Handle OAuth errors
    if (error) {
      console.error('Google OAuth error:', error)
      const dashboardUrl = new URL('/dashboard/scheduling', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      dashboardUrl.searchParams.set('error', `Google OAuth failed: ${error}`)
      return NextResponse.redirect(dashboardUrl.toString())
    }

    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code' },
        { status: 400 }
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      )
    }

    const redirectUri = `${appUrl}/api/auth/google-calendar/callback`

    // Step 1: Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', tokenResponse.status, errorText)
      const dashboardUrl = new URL('/dashboard/scheduling', appUrl)
      dashboardUrl.searchParams.set('error', 'Token exchange failed')
      return NextResponse.redirect(dashboardUrl.toString())
    }

    const tokenData = await tokenResponse.json()

    if (!tokenData.access_token || !tokenData.refresh_token) {
      console.error('Missing tokens in response:', tokenData)
      const dashboardUrl = new URL('/dashboard/scheduling', appUrl)
      dashboardUrl.searchParams.set('error', 'Missing tokens from Google')
      return NextResponse.redirect(dashboardUrl.toString())
    }

    // Step 2: Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info:', userInfoResponse.status)
      // Continue anyway - user info is optional
    }

    const userInfo = userInfoResponse.ok ? await userInfoResponse.json() : {}

    // Step 3: Store tokens in Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Calculate token expiry (Google typically gives 3600 seconds = 1 hour)
    const expiresIn = tokenData.expires_in || 3600
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Check if token already exists for this user (upsert logic)
    const { data: existingToken } = await supabase
      .from('google_calendar_tokens')
      .select('id')
      .eq('google_email', userInfo.email)
      .single()

    if (existingToken) {
      // Update existing token
      const { error: updateError } = await supabase
        .from('google_calendar_tokens')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_type: tokenData.token_type || 'Bearer',
          expires_at: expiresAt,
          google_user_id: userInfo.id,
          last_refresh_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingToken.id)

      if (updateError) {
        console.error('Failed to update tokens:', updateError)
        const dashboardUrl = new URL('/dashboard/scheduling', appUrl)
        dashboardUrl.searchParams.set('error', 'Failed to update tokens')
        return NextResponse.redirect(dashboardUrl.toString())
      }
    } else {
      // Insert new token
      const { error: insertError } = await supabase
        .from('google_calendar_tokens')
        .insert({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_type: tokenData.token_type || 'Bearer',
          expires_at: expiresAt,
          google_email: userInfo.email,
          google_user_id: userInfo.id,
          calendar_id: 'primary',
          user_id: null, // Single-user setup for now
          tenant_id: null, // Can be set later if multi-tenant
        })

      if (insertError) {
        console.error('Failed to insert tokens:', insertError)
        const dashboardUrl = new URL('/dashboard/scheduling', appUrl)
        dashboardUrl.searchParams.set('error', 'Failed to store tokens')
        return NextResponse.redirect(dashboardUrl.toString())
      }
    }

    // Step 4: Redirect to dashboard with success message
    const dashboardUrl = new URL('/dashboard/scheduling', appUrl)
    dashboardUrl.searchParams.set('success', 'Google Calendar connected successfully')
    dashboardUrl.searchParams.set('provider', 'google-calendar')

    return NextResponse.redirect(dashboardUrl.toString())
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const dashboardUrl = new URL('/dashboard/scheduling', appUrl)
    dashboardUrl.searchParams.set('error', `Unexpected error: ${error.message}`)
    return NextResponse.redirect(dashboardUrl.toString())
  }
}
