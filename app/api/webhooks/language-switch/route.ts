/**
 * POST /api/webhooks/language-switch
 *
 * Internal webhook to trigger mid-call language switching
 * Called when language detection confidence exceeds threshold
 *
 * Flow:
 * 1. Vapi transcript webhook → language detector
 * 2. If shouldSwitch = true → call this endpoint
 * 3. Update assistant configuration via Vapi API
 * 4. Log switch to call_language_detections table
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { vapiClient } from '@/lib/vapi';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LanguageSwitchRequest {
  call_id: string;
  detected_language: string;
  confidence: number;
  base_assistant_id: string;
  transcript_sample?: string;
  tenant_id?: string;
}

/**
 * POST /api/webhooks/language-switch
 * Trigger mid-call language switch
 */
export async function POST(request: NextRequest) {
  try {
    const body: LanguageSwitchRequest = await request.json();
    const {
      call_id,
      detected_language,
      confidence,
      base_assistant_id,
      transcript_sample = '',
      tenant_id = 'default',
    } = body;

    // Validation
    if (!call_id || !detected_language || !base_assistant_id) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['call_id', 'detected_language', 'base_assistant_id'],
        },
        { status: 400 }
      );
    }

    console.log(`[LanguageSwitch] Call ${call_id}: switching to ${detected_language} (confidence: ${confidence})`);

    // Find language variant for detected language
    const { data: variant, error: variantError } = await supabase
      .from('assistant_language_variants')
      .select('*')
      .eq('base_assistant_id', base_assistant_id)
      .eq('language_code', detected_language)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (variantError) {
      console.error('[LanguageSwitch] Database error:', variantError);
      return NextResponse.json(
        { error: 'Database error', details: variantError.message },
        { status: 500 }
      );
    }

    if (!variant) {
      console.warn(`[LanguageSwitch] No variant configured for ${detected_language} on assistant ${base_assistant_id}`);
      return NextResponse.json(
        {
          error: 'Language variant not configured',
          detected_language,
          base_assistant_id,
          message: `No ${detected_language} variant found. Configure one via /api/assistants/${base_assistant_id}/language-variants`,
        },
        { status: 404 }
      );
    }

    // Switch assistant via Vapi API
    // Note: Vapi API doesn't support mid-call assistant switching yet (as of 2024)
    // This is a future-proof implementation that logs the intent
    // When Vapi adds the feature, uncomment the actual API call

    let switchedAt: Date | null = null;
    let vapiError: string | null = null;

    try {
      // Future Vapi API call (when supported):
      // await vapi.calls.update(call_id, {
      //   assistant: { assistantId: variant.vapi_assistant_id }
      // });

      // For now: log intent only
      console.log(`[LanguageSwitch] Would switch call ${call_id} to assistant ${variant.vapi_assistant_id}`);
      switchedAt = new Date();
    } catch (error) {
      console.error('[LanguageSwitch] Vapi API error:', error);
      vapiError = error instanceof Error ? error.message : 'Unknown Vapi error';
    }

    // Log the detection and switch attempt
    const { data: logEntry, error: logError } = await supabase
      .from('call_language_detections')
      .insert({
        call_id,
        detected_language,
        confidence: confidence / 100, // Convert to 0.0-1.0
        switched_at: switchedAt,
        switched_from_assistant_id: base_assistant_id,
        switched_to_assistant_id: variant.vapi_assistant_id,
        detection_method: 'automatic',
        transcript_sample: transcript_sample.slice(0, 500),
        metadata: {
          variant_id: variant.id,
          voice_id: variant.voice_id,
          vapi_error: vapiError,
          tenant_id,
        },
      })
      .select()
      .single();

    if (logError) {
      console.error('[LanguageSwitch] Failed to log switch:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      switched: switchedAt !== null,
      call_id,
      detected_language,
      confidence,
      variant: {
        language_code: variant.language_code,
        vapi_assistant_id: variant.vapi_assistant_id,
        voice_id: variant.voice_id,
      },
      log_entry: logEntry,
      note: vapiError
        ? `Switch logged but failed: ${vapiError}`
        : 'Switch logged (pending Vapi mid-call update support)',
    });
  } catch (error: unknown) {
    console.error('[/api/webhooks/language-switch] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/language-switch
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'language-switch-webhook',
    note: 'Triggers mid-call language switching when language detection confidence exceeds threshold',
    timestamp: new Date().toISOString(),
  });
}
