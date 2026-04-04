// F0261: Campaign cooldown API
// Manage 24h cooldown between campaign runs for contacts

import { NextRequest, NextResponse } from 'next/server';
import {
  isContactInCooldown,
  setContactCooldown,
  clearContactCooldown
} from '@/lib/campaign-cooldown';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/contacts/:id/cooldown
 * Check if contact is in cooldown
 * F0261: Campaign cooldown check
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

    const inCooldown = await isContactInCooldown(contactId);

    // Get cooldown details
    const { data } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('id, name, phone, last_contacted_at, cooldown_until')
      .eq('id', contactId)
      .single();

    return NextResponse.json({
      contact_id: contactId,
      name: data?.name,
      phone: data?.phone,
      in_cooldown: inCooldown,
      last_contacted_at: data?.last_contacted_at,
      cooldown_until: data?.cooldown_until,
      can_contact: !inCooldown
    });
  } catch (error: any) {
    console.error('Get cooldown error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check cooldown' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/contacts/:id/cooldown
 * Set cooldown for a contact
 * F0261: Campaign cooldown enforcement
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
    const { cooldown_hours } = body;

    const hours = cooldown_hours ? parseInt(cooldown_hours, 10) : 24;

    if (isNaN(hours) || hours < 0) {
      return NextResponse.json(
        { error: 'Invalid cooldown_hours' },
        { status: 400 }
      );
    }

    await setContactCooldown(contactId, hours);

    // Fetch updated contact
    const { data } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('id, name, phone, last_contacted_at, cooldown_until')
      .eq('id', contactId)
      .single();

    return NextResponse.json({
      success: true,
      message: `Cooldown set for ${hours} hours`,
      contact: data
    });
  } catch (error: any) {
    console.error('Set cooldown error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to set cooldown' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contacts/:id/cooldown
 * Clear cooldown for a contact (manual override)
 * F0261: Clear campaign cooldown
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

    await clearContactCooldown(contactId);

    // Fetch updated contact
    const { data } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('id, name, phone, last_contacted_at, cooldown_until')
      .eq('id', contactId)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Cooldown cleared',
      contact: data
    });
  } catch (error: any) {
    console.error('Clear cooldown error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clear cooldown' },
      { status: 500 }
    );
  }
}
