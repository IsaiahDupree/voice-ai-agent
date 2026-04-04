import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0141: Inbound webhook trigger configuration
 * Manages external webhook URLs for call events
 */

// GET /api/webhooks/config - List all webhook configurations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const event = searchParams.get('event'); // Optional filter by event type

    let query = supabaseAdmin
      .from('webhook_configs')
      .select('*')
      .order('created_at', { ascending: false });

    if (event) {
      query = query.eq('event_type', event);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      webhooks: data || [],
      count: data?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching webhook configs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch webhook configs' },
      { status: 500 }
    );
  }
}

// POST /api/webhooks/config - Create new webhook configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, event_type, secret, enabled, headers } = body;

    if (!url || !event_type) {
      return NextResponse.json(
        { error: 'url and event_type are required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Validate event_type
    const validEvents = [
      'call.started',
      'call.ended',
      'call.transferred',
      'transcript.received',
      'booking.created',
      'sms.sent',
    ];

    if (!validEvents.includes(event_type)) {
      return NextResponse.json(
        {
          error: `Invalid event_type. Must be one of: ${validEvents.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('webhook_configs')
      .insert({
        url,
        event_type,
        secret: secret || null,
        enabled: enabled !== false, // Default to true
        headers: headers || {},
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      webhook: data,
    });
  } catch (error: any) {
    console.error('Error creating webhook config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create webhook config' },
      { status: 500 }
    );
  }
}

// DELETE /api/webhooks/config - Delete webhook configuration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('webhook_configs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Webhook configuration deleted',
    });
  } catch (error: any) {
    console.error('Error deleting webhook config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete webhook config' },
      { status: 500 }
    );
  }
}
