/**
 * GET/POST /api/dtmf/menus
 *
 * Manage DTMF menu configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateMenuTree } from '@/lib/dtmf-router';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/dtmf/menus
 * List all DTMF menus
 * F011: Graceful fallback for /api/dtmf/menus
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id') || 'default';
    const activeOnly = searchParams.get('active') === 'true';

    let query = supabase.from('dtmf_menus').select('*').eq('tenant_id', tenantId);

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    // F011: Graceful fallback for schema errors
    if (error?.code === 'PGRST204' || error?.message?.includes('does not exist') || error?.message?.includes('schema cache') || error?.message?.includes('Could not find')) {
      console.warn('[/api/dtmf/menus] Schema error detected, returning graceful fallback:', error);
      return NextResponse.json({
        menus: []
      }, { status: 200 });
    }

    if (error) {
      console.error('[/api/dtmf/menus] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch DTMF menus', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      tenant_id: tenantId,
    });
  } catch (error: unknown) {
    // F011: Graceful fallback for schema-related errors
    if (error instanceof Error && (error.message?.includes('does not exist') || error.message?.includes('PGRST204'))) {
      console.warn('[/api/dtmf/menus] Schema error caught in try/catch:', error);
      return NextResponse.json({
        menus: []
      }, { status: 200 });
    }

    console.error('[/api/dtmf/menus] Error:', error);
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
 * POST /api/dtmf/menus
 * Create a new DTMF menu
 * F011: Graceful fallback for /api/dtmf/menus
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      menu_tree,
      timeout_seconds = 10,
      max_retries = 3,
      invalid_message = 'Invalid selection. Please try again.',
      timeout_message = "I didn't hear your selection. Please press a key.",
      active = true,
      tenant_id = 'default',
    } = body;

    // Validation
    if (!name || !menu_tree) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['name', 'menu_tree'],
        },
        { status: 400 }
      );
    }

    // Validate menu tree structure
    const validation = validateMenuTree(menu_tree);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid menu tree structure',
          validation_errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Insert
    const { data, error } = await supabase
      .from('dtmf_menus')
      .insert({
        name,
        description,
        menu_tree,
        timeout_seconds,
        max_retries,
        invalid_message,
        timeout_message,
        active,
        tenant_id,
      })
      .select()
      .single();

    // F011: Graceful fallback for schema errors
    if (error?.code === 'PGRST204' || error?.message?.includes('does not exist') || error?.message?.includes('schema cache') || error?.message?.includes('Could not find')) {
      console.warn('[/api/dtmf/menus] Schema error on insert, returning graceful fallback:', error);
      return NextResponse.json({
        error: 'DTMF menu table schema error'
      }, { status: 400 });
    }

    if (error) {
      console.error('[/api/dtmf/menus] Insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create DTMF menu', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
        message: `DTMF menu "${name}" created successfully`,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    // F011: Graceful fallback for schema-related errors
    if (error instanceof Error && (error.message?.includes('does not exist') || error.message?.includes('PGRST204'))) {
      console.warn('[/api/dtmf/menus] Schema error caught in try/catch:', error);
      return NextResponse.json({
        error: 'DTMF menu table schema error'
      }, { status: 400 });
    }

    console.error('[/api/dtmf/menus] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
