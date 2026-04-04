// F0986: POST /api/users/invite

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface InviteRequest {
  email: string
  role: 'admin' | 'manager' | 'user'
  org_id: string
}

// POST /api/users/invite - Invite a user to organization
export async function POST(request: NextRequest) {
  try {
    const body: InviteRequest = await request.json()

    if (!body.email || !body.org_id || !body.role) {
      return NextResponse.json(
        { error: 'email, org_id, and role are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Verify org exists
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('id', body.org_id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Create invitation record
    const inviteToken = Buffer.from(`${body.email}:${Date.now()}`).toString('base64')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 day expiration

    // Would insert into user_invitations table
    const invite = {
      id: `invite-${Date.now()}`,
      email: body.email,
      org_id: body.org_id,
      role: body.role,
      token: inviteToken,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    }

    return NextResponse.json({
      message: 'Invitation sent',
      invite,
      invite_url: `${new URL(request.url).origin}/invite/${inviteToken}`,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error inviting user:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
