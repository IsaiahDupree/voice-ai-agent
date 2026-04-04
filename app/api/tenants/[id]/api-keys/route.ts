/**
 * Feature 137: Tenant API Key Management
 * POST /api/tenants/:id/api-keys - Create new API key
 * GET /api/tenants/:id/api-keys - List API keys
 * DELETE /api/tenants/:id/api-keys - Revoke API key
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createTenantApiKey,
  listTenantApiKeys,
  revokeTenantApiKey,
} from '@/lib/tenant-api-auth'

/**
 * Create new API key for tenant
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: tenantId } = params
    const body = await request.json()
    const { name, scopes, expires_in_days } = body

    if (!name) {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      )
    }

    // Calculate expiration date if provided
    let expiresAt: Date | undefined
    if (expires_in_days) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expires_in_days)
    }

    // Create API key
    const result = await createTenantApiKey({
      tenantId,
      name,
      scopes: scopes || ['*'], // Default to all permissions
      expiresAt,
    })

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create API key' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        api_key: {
          id: result.id,
          key: result.key, // Only shown once!
          name,
          scopes: scopes || ['*'],
          expires_at: expiresAt?.toISOString() || null,
        },
        warning: 'Store this API key securely. It will not be shown again.',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error in POST /api/tenants/:id/api-keys:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * List API keys for tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: tenantId } = params

    const apiKeys = await listTenantApiKeys(tenantId)

    return NextResponse.json({
      api_keys: apiKeys,
      count: apiKeys.length,
    })
  } catch (error: any) {
    console.error('Error in GET /api/tenants/:id/api-keys:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Revoke API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: tenantId } = params
    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('key_id')

    if (!keyId) {
      return NextResponse.json(
        { error: 'key_id parameter is required' },
        { status: 400 }
      )
    }

    const success = await revokeTenantApiKey(keyId, tenantId)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to revoke API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'API key revoked successfully',
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/tenants/:id/api-keys:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
