// F1133: Revoke API key endpoint

import { NextRequest, NextResponse } from 'next/server'
import { revokeApiKey } from '@/lib/api-keys'

/**
 * POST /api/api-keys/:id/revoke
 * Revoke an API key (mark as revoked)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const keyId = params.id

    if (!keyId) {
      return NextResponse.json(
        { error: 'keyId is required' },
        { status: 400 }
      )
    }

    const success = await revokeApiKey(keyId)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to revoke API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'API key revoked',
      id: keyId,
    })
  } catch (error: any) {
    console.error('Error revoking API key:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to revoke API key' },
      { status: 500 }
    )
  }
}
