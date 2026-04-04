/**
 * GET/PUT /api/assistants/:id/interruption-config
 * Manage semantic VAD interruption sensitivity settings per assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/assistants/:id/interruption-config
 * Fetch interruption config for an assistant
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const assistantId = context.params.id;

  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_interruption_config')
      .select('*')
      .eq('assistant_id', assistantId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      throw error;
    }

    // Return default config if none exists
    if (!data) {
      return NextResponse.json({
        assistantId,
        sensitivity: 'medium',
        enabled: true,
        confidenceThreshold: 0.70,
        notes: null,
        isDefault: true,
      });
    }

    return NextResponse.json({
      assistantId: data.assistant_id,
      sensitivity: data.sensitivity,
      enabled: data.enabled,
      confidenceThreshold: data.confidence_threshold,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isDefault: false,
    });
  } catch (error: any) {
    console.error('[GET Interruption Config Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch interruption config',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/assistants/:id/interruption-config
 * Update interruption config for an assistant
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const assistantId = context.params.id;

  try {
    const body = await request.json();
    const { sensitivity, enabled, confidenceThreshold, notes } = body;

    // Validate sensitivity
    if (sensitivity && !['low', 'medium', 'high'].includes(sensitivity)) {
      return NextResponse.json(
        { error: 'sensitivity must be low, medium, or high' },
        { status: 400 }
      );
    }

    // Validate confidence threshold
    if (
      confidenceThreshold !== undefined &&
      (confidenceThreshold < 0 || confidenceThreshold > 1)
    ) {
      return NextResponse.json(
        { error: 'confidenceThreshold must be between 0 and 1' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: any = {
      assistant_id: assistantId,
    };

    if (sensitivity !== undefined) updateData.sensitivity = sensitivity;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (confidenceThreshold !== undefined)
      updateData.confidence_threshold = confidenceThreshold;
    if (notes !== undefined) updateData.notes = notes;

    // Upsert config
    const { data, error } = await supabaseAdmin
      .from('voice_agent_interruption_config')
      .upsert(updateData, {
        onConflict: 'assistant_id',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      config: {
        assistantId: data.assistant_id,
        sensitivity: data.sensitivity,
        enabled: data.enabled,
        confidenceThreshold: data.confidence_threshold,
        notes: data.notes,
        updatedAt: data.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[PUT Interruption Config Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to update interruption config',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/assistants/:id/interruption-config
 * Reset to default interruption config (delete custom config)
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const assistantId = context.params.id;

  try {
    const { error } = await supabaseAdmin
      .from('voice_agent_interruption_config')
      .delete()
      .eq('assistant_id', assistantId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Interruption config reset to defaults',
      assistantId,
    });
  } catch (error: any) {
    console.error('[DELETE Interruption Config Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to reset interruption config',
      },
      { status: 500 }
    );
  }
}
