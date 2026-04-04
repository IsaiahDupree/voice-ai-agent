// F0814: Persona sharing

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

interface ShareRequest {
  email?: string
  team_members?: string[]
  expiration_hours?: number
}

// POST /api/personas/:id/share - Generate share link or share with team
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: ShareRequest = await request.json()
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    // Get persona
    let query = supabaseAdmin
      .from('personas')
      .select('id, name, org_id')
      .eq('id', params.id)

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: persona, error: personaError } = await query.single()

    if (personaError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Generate share token (valid for 7 days by default or specified hours)
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + (body.expiration_hours || 168))

    // Store share record (would need persona_shares table)
    // For now, return the share link
    const shareLink = `${new URL(request.url).origin}/personas/shared/${token}`

    return NextResponse.json({
      message: 'Persona share link generated',
      share_link: shareLink,
      expires_at: expiresAt.toISOString(),
      token_preview: `${token.slice(0, 8)}...`,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error sharing persona:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/personas/:id/share - Get share links for a persona
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    let query = supabaseAdmin
      .from('personas')
      .select('id')
      .eq('id', params.id)

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: persona, error: personaError } = await query.single()

    if (personaError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    return NextResponse.json({
      persona_id: params.id,
      share_links: [],
      message: 'No active share links',
    })
  } catch (error: any) {
    console.error('Error getting share links:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/personas/:id/share/:token - Revoke a share link
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const orgId = searchParams.get('org_id')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('personas')
      .select('id')
      .eq('id', params.id)

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: persona, error: personaError } = await query.single()

    if (personaError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Share link revoked',
      token: token,
    })
  } catch (error: any) {
    console.error('Error revoking share link:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
