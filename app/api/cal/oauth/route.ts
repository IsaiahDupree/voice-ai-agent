import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0319: POST /api/cal/oauth - Handle Cal.com OAuth token exchange
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, redirectUri, clientId, clientSecret } = body

    if (!code || !redirectUri) {
      return NextResponse.json(
        { error: 'code and redirectUri are required' },
        { status: 400 }
      )
    }

    const calComClientId = clientId || process.env.CALCOM_CLIENT_ID
    const calComClientSecret = clientSecret || process.env.CALCOM_CLIENT_SECRET

    if (!calComClientId || !calComClientSecret) {
      return NextResponse.json(
        { error: 'Cal.com OAuth credentials not configured' },
        { status: 500 }
      )
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://app.cal.com/api/auth/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: calComClientId,
        client_secret: calComClientSecret,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Cal.com OAuth token exchange failed:', errorText)
      return NextResponse.json(
        { error: `Cal.com OAuth error: ${errorText}` },
        { status: tokenResponse.status }
      )
    }

    const tokenData = await tokenResponse.json()

    // Store the OAuth token in Supabase for multi-tenant setup
    const { data: stored, error: storeError } = await supabaseAdmin
      .from('calcom_oauth_tokens')
      .insert({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (storeError) {
      console.error('Failed to store Cal.com OAuth token:', storeError)
      return NextResponse.json(
        { error: 'Failed to store OAuth token' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Cal.com OAuth token stored successfully',
        token_id: stored.id,
        expires_at: stored.expires_at,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error handling Cal.com OAuth:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to handle Cal.com OAuth',
      },
      { status: 500 }
    )
  }
}

// F0319: GET /api/cal/oauth - Verify Cal.com OAuth status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tokenId = searchParams.get('token_id')

    if (!tokenId) {
      return NextResponse.json(
        { error: 'token_id is required' },
        { status: 400 }
      )
    }

    const { data: token, error } = await supabaseAdmin
      .from('calcom_oauth_tokens')
      .select('*')
      .eq('id', tokenId)
      .single()

    if (error || !token) {
      return NextResponse.json(
        { error: 'OAuth token not found' },
        { status: 404 }
      )
    }

    const expiresAt = new Date(token.expires_at)
    const isExpired = expiresAt < new Date()

    return NextResponse.json({
      success: true,
      token_id: token.id,
      token_type: token.token_type,
      expires_at: token.expires_at,
      is_expired: isExpired,
      created_at: token.created_at,
    })
  } catch (error: any) {
    console.error('Error checking Cal.com OAuth status:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to check OAuth status',
      },
      { status: 500 }
    )
  }
}
