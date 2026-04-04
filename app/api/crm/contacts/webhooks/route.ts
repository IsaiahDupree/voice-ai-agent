// F0607: Contact webhook trigger

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface WebhookConfig {
  org_id: string
  event_type: 'contact_created' | 'contact_updated' | 'contact_deleted' | 'call_completed'
  url: string
  active: boolean
}

// GET /api/crm/contacts/webhooks - List configured webhooks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    if (!orgId) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    }

    // Get webhooks from contact_webhooks table
    const { data: webhooks, error } = await supabaseAdmin
      .from('contact_webhooks')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      org_id: orgId,
      webhooks: webhooks || [],
      total: webhooks?.length || 0,
    })
  } catch (error: any) {
    console.error('Error fetching webhooks:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/crm/contacts/webhooks - Register a webhook
export async function POST(request: NextRequest) {
  try {
    const body: WebhookConfig = await request.json()

    if (!body.org_id || !body.event_type || !body.url) {
      return NextResponse.json(
        { error: 'org_id, event_type, and url are required' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(body.url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Create webhook record
    const { data: webhook, error } = await supabaseAdmin
      .from('contact_webhooks')
      .insert({
        org_id: body.org_id,
        event_type: body.event_type,
        url: body.url,
        active: body.active !== false,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { message: 'Webhook registered', webhook },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error registering webhook:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
