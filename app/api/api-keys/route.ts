// F1133: API key authentication endpoints
// F1134: API key hashing - secure storage

import { NextRequest, NextResponse } from 'next/server'
import { createApiKey, revokeApiKey, listApiKeys } from '@/lib/api-keys'

/**
 * GET /api/api-keys
 * List API keys for authenticated user
 * Requires: Authentication header (JWT or API key)
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Extract and validate auth token to get owner ID
    // For now, extract from header
    const owner = request.headers.get('x-user-id') || 'system'

    const keys = await listApiKeys(owner)

    return NextResponse.json({
      success: true,
      keys,
    })
  } catch (error: any) {
    console.error('Error listing API keys:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list API keys' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/api-keys
 * Create a new API key
 * Body: { name: string, scopes?: string[], expiresAt?: ISO8601 }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, scopes, expiresAt } = body
    const owner = request.headers.get('x-user-id') || 'system'

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    const result = await createApiKey({
      name,
      owner,
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    })

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create API key' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'API key created. Save this key in a secure location.',
        id: result.id,
        key: result.key, // Only returned once
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating API key:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create API key' },
      { status: 500 }
    )
  }
}
