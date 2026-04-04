import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0152: Call screen option
 * Configure assistant to screen calls before human handoff
 */

// GET /api/assistant/:id/screen-config
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

    const screenConfig = persona.metadata?.screen_config || {
      enabled: false,
      questions: [],
      summary_template: null,
    };

    return NextResponse.json({
      assistant_id: params.id,
      screen_config: screenConfig,
    });
  } catch (error: any) {
    console.error('Error fetching screen config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch screen config' },
      { status: 500 }
    );
  }
}

// PUT /api/assistant/:id/screen-config
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { enabled, questions, summary_template } = body;

    // Validate questions array
    if (enabled && (!questions || !Array.isArray(questions))) {
      return NextResponse.json(
        { error: 'questions array required when screening is enabled' },
        { status: 400 }
      );
    }

    // Get existing persona
    const { data: persona } = await supabaseAdmin
      .from('personas')
      .select('metadata')
      .eq('id', params.id)
      .single();

    // Update with screen config
    const { data, error } = await supabaseAdmin
      .from('personas')
      .update({
        metadata: {
          ...persona?.metadata,
          screen_config: {
            enabled: enabled !== false,
            questions: questions || [],
            summary_template:
              summary_template ||
              'Call screened from {{caller_name}}. Purpose: {{purpose}}. Urgency: {{urgency}}.',
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
      assistant_id: params.id,
      screen_config: data.metadata.screen_config,
    });
  } catch (error: any) {
    console.error('Error updating screen config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update screen config' },
      { status: 500 }
    );
  }
}

/**
 * Example screen config:
 * {
 *   "enabled": true,
 *   "questions": [
 *     "What is the purpose of your call?",
 *     "Is this an urgent matter?",
 *     "Can I get your name and company?"
 *   ],
 *   "summary_template": "Call from {{name}} at {{company}}. Reason: {{purpose}}. Urgency: {{urgency}}."
 * }
 */
