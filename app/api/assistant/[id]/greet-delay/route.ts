import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0153: Inbound greet delay
 * Configurable delay (0-3 seconds) before assistant speaks first
 */

// GET /api/assistant/:id/greet-delay
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: persona, error } = await supabaseAdmin
      .from('personas')
      .select('id, name, metadata')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    const greetDelayMs = persona.metadata?.greet_delay_ms || 0;

    return NextResponse.json({
      assistant_id: params.id,
      assistant_name: persona.name,
      greet_delay_ms: greetDelayMs,
      greet_delay_seconds: greetDelayMs / 1000,
    });
  } catch (error: any) {
    console.error('Error fetching greet delay:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch greet delay' },
      { status: 500 }
    );
  }
}

// PUT /api/assistant/:id/greet-delay
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { delay_seconds, delay_ms } = body;

    // Allow either delay_seconds or delay_ms
    let delayMs = delay_ms;

    if (delay_seconds !== undefined) {
      delayMs = delay_seconds * 1000;
    }

    if (delayMs === undefined) {
      return NextResponse.json(
        { error: 'delay_seconds or delay_ms is required' },
        { status: 400 }
      );
    }

    // Validate range (0-3 seconds = 0-3000ms)
    if (delayMs < 0 || delayMs > 3000) {
      return NextResponse.json(
        { error: 'delay must be between 0 and 3000ms (0-3 seconds)' },
        { status: 400 }
      );
    }

    // Get existing persona
    const { data: persona } = await supabaseAdmin
      .from('personas')
      .select('metadata')
      .eq('id', params.id)
      .single();

    // Update greet delay
    const { data, error } = await supabaseAdmin
      .from('personas')
      .update({
        metadata: {
          ...persona?.metadata,
          greet_delay_ms: delayMs,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      assistant_id: params.id,
      greet_delay_ms: delayMs,
      greet_delay_seconds: delayMs / 1000,
    });
  } catch (error: any) {
    console.error('Error updating greet delay:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update greet delay' },
      { status: 500 }
    );
  }
}
