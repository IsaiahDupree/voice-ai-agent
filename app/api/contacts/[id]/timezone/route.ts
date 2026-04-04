// F0258: Contact timezone override API
// Allow manual timezone override per contact

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/contacts/:id/timezone
 * Get current timezone for a contact
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contactId = parseInt(params.id, 10);

    if (isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid contact ID' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('id, name, timezone, timezone_override, timezone_source')
      .eq('id', contactId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      contact_id: data.id,
      name: data.name,
      timezone: data.timezone,
      timezone_override: data.timezone_override,
      timezone_source: data.timezone_source,
      effective_timezone: data.timezone_override || data.timezone || 'America/New_York'
    });
  } catch (error: any) {
    console.error('Get timezone error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get timezone' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/contacts/:id/timezone
 * Set timezone override for a contact
 * F0258: Manual timezone override
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contactId = parseInt(params.id, 10);

    if (isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid contact ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { timezone } = body;

    if (!timezone) {
      return NextResponse.json(
        { error: 'timezone is required' },
        { status: 400 }
      );
    }

    // Validate timezone (basic check)
    try {
      Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      return NextResponse.json(
        { error: 'Invalid timezone identifier' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .update({
        timezone_override: timezone,
        timezone_source: 'manual',
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .select('id, name, timezone, timezone_override, timezone_source')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Timezone override set',
      contact: data,
      effective_timezone: data.timezone_override || data.timezone
    });
  } catch (error: any) {
    console.error('Set timezone override error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to set timezone override' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contacts/:id/timezone
 * Clear timezone override (revert to auto-detected)
 * F0258: Clear manual override
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contactId = parseInt(params.id, 10);

    if (isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid contact ID' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .update({
        timezone_override: null,
        timezone_source: 'auto',
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .select('id, name, timezone, timezone_override, timezone_source')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Timezone override cleared',
      contact: data,
      effective_timezone: data.timezone || 'America/New_York'
    });
  } catch (error: any) {
    console.error('Clear timezone override error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clear timezone override' },
      { status: 500 }
    );
  }
}
