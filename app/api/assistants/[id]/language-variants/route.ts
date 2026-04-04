/**
 * GET/POST /api/assistants/:id/language-variants
 *
 * Manage language variants for a base assistant
 * Supports multilingual auto-switching
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSupportedLanguage, SUPPORTED_LANGUAGES } from '@/lib/language-detector';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LanguageVariant {
  id?: number;
  base_assistant_id: string;
  language_code: string;
  vapi_assistant_id: string;
  voice_id?: string;
  system_prompt_template?: string;
  stt_language?: string;
  tts_language?: string;
  tenant_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * GET /api/assistants/:id/language-variants
 * List all language variants for an assistant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: baseAssistantId } = params;
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id') || 'default';

    const { data, error } = await supabase
      .from('assistant_language_variants')
      .select('*')
      .eq('base_assistant_id', baseAssistantId)
      .eq('tenant_id', tenantId)
      .order('language_code', { ascending: true });

    if (error) {
      console.error('[/api/assistants/:id/language-variants] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch language variants', details: error.message },
        { status: 500 }
      );
    }

    // Enrich with language names
    const enriched = data.map((variant: LanguageVariant) => ({
      ...variant,
      language_name: SUPPORTED_LANGUAGES[variant.language_code as keyof typeof SUPPORTED_LANGUAGES] || 'Unknown',
    }));

    return NextResponse.json({
      success: true,
      data: enriched,
      count: enriched.length,
      base_assistant_id: baseAssistantId,
      tenant_id: tenantId,
    });
  } catch (error: unknown) {
    console.error('[/api/assistants/:id/language-variants] Error:', error);
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
 * POST /api/assistants/:id/language-variants
 * Create a new language variant for an assistant
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: baseAssistantId } = params;
    const body = await request.json();

    const {
      language_code,
      vapi_assistant_id,
      voice_id,
      system_prompt_template,
      stt_language,
      tts_language,
      tenant_id = 'default',
      metadata = {},
    } = body;

    // Validation
    if (!language_code || !vapi_assistant_id) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['language_code', 'vapi_assistant_id'],
        },
        { status: 400 }
      );
    }

    if (!isSupportedLanguage(language_code)) {
      return NextResponse.json(
        {
          error: `Unsupported language: ${language_code}`,
          supported: Object.keys(SUPPORTED_LANGUAGES),
        },
        { status: 400 }
      );
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('assistant_language_variants')
      .select('id')
      .eq('base_assistant_id', baseAssistantId)
      .eq('language_code', language_code)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: 'Language variant already exists',
          language_code,
          base_assistant_id: baseAssistantId,
          existing_id: existing.id,
        },
        { status: 409 }
      );
    }

    // Insert
    const { data, error } = await supabase
      .from('assistant_language_variants')
      .insert({
        base_assistant_id: baseAssistantId,
        language_code,
        vapi_assistant_id,
        voice_id,
        system_prompt_template,
        stt_language: stt_language || language_code,
        tts_language: tts_language || language_code,
        tenant_id,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error('[/api/assistants/:id/language-variants] Insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create language variant', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...data,
          language_name: SUPPORTED_LANGUAGES[language_code as keyof typeof SUPPORTED_LANGUAGES],
        },
        message: `Language variant ${language_code} created successfully`,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('[/api/assistants/:id/language-variants] Error:', error);
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
 * DELETE /api/assistants/:id/language-variants
 * Delete a language variant
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: baseAssistantId } = params;
    const searchParams = request.nextUrl.searchParams;
    const languageCode = searchParams.get('language_code');
    const tenantId = searchParams.get('tenant_id') || 'default';

    if (!languageCode) {
      return NextResponse.json(
        { error: 'Missing required parameter: language_code' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('assistant_language_variants')
      .delete()
      .eq('base_assistant_id', baseAssistantId)
      .eq('language_code', languageCode)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[/api/assistants/:id/language-variants] Delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete language variant', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Language variant ${languageCode} deleted successfully`,
      base_assistant_id: baseAssistantId,
      language_code: languageCode,
    });
  } catch (error: unknown) {
    console.error('[/api/assistants/:id/language-variants] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
