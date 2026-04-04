import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0216: Caller ID rotation
 * Manage pool of caller IDs and rotation strategy to reduce spam flagging
 */

// GET /api/campaigns/:id/caller-id-pool
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: campaign, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('id, name, metadata')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    const callerIdConfig = campaign.metadata?.caller_id_rotation || {
      enabled: false,
      pool: [],
      strategy: 'round-robin',
    };

    return NextResponse.json({
      campaign_id: params.id,
      caller_id_config: callerIdConfig,
    });
  } catch (error: any) {
    console.error('Error fetching caller ID pool:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch caller ID pool' },
      { status: 500 }
    );
  }
}

// PUT /api/campaigns/:id/caller-id-pool
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { enabled, pool, strategy } = body;

    if (!pool || !Array.isArray(pool)) {
      return NextResponse.json(
        { error: 'pool array is required' },
        { status: 400 }
      );
    }

    // Validate phone numbers in pool
    for (const number of pool) {
      if (typeof number !== 'string' || !number.match(/^\+?[1-9]\d{1,14}$/)) {
        return NextResponse.json(
          { error: `Invalid phone number format: ${number}` },
          { status: 400 }
        );
      }
    }

    // Validate strategy
    const validStrategies = ['round-robin', 'random', 'sequential', 'least-used'];
    if (strategy && !validStrategies.includes(strategy)) {
      return NextResponse.json(
        { error: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}` },
        { status: 400 }
      );
    }

    // Get existing campaign
    const { data: campaign } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('metadata')
      .eq('id', params.id)
      .single();

    // Update with caller ID rotation config
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .update({
        metadata: {
          ...campaign?.metadata,
          caller_id_rotation: {
            enabled: enabled !== false,
            pool,
            strategy: strategy || 'round-robin',
            current_index: 0,
            usage_stats: pool.reduce((acc: any, num: string) => {
              acc[num] = 0;
              return acc;
            }, {}),
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      campaign_id: params.id,
      caller_id_config: data.metadata.caller_id_rotation,
    });
  } catch (error: any) {
    console.error('Error updating caller ID pool:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update caller ID pool' },
      { status: 500 }
    );
  }
}
