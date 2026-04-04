/**
 * GET/PUT/DELETE /api/dtmf/menus/:id
 *
 * Manage individual DTMF menu
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateMenuTree } from '@/lib/dtmf-router';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/dtmf/menus/:id
 * Fetch a specific DTMF menu
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id') || 'default';

    const { data, error } = await supabase
      .from('dtmf_menus')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      console.error('[/api/dtmf/menus/:id] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch DTMF menu', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'DTMF menu not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: unknown) {
    console.error('[/api/dtmf/menus/:id] Error:', error);
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
 * PUT /api/dtmf/menus/:id
 * Update a DTMF menu
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      name,
      description,
      menu_tree,
      timeout_seconds,
      max_retries,
      invalid_message,
      timeout_message,
      active,
      tenant_id = 'default',
    } = body;

    // Validate menu tree if provided
    if (menu_tree) {
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
    }

    // Build update object (only include provided fields)
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (menu_tree !== undefined) updates.menu_tree = menu_tree;
    if (timeout_seconds !== undefined) updates.timeout_seconds = timeout_seconds;
    if (max_retries !== undefined) updates.max_retries = max_retries;
    if (invalid_message !== undefined) updates.invalid_message = invalid_message;
    if (timeout_message !== undefined) updates.timeout_message = timeout_message;
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabase
      .from('dtmf_menus')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) {
      console.error('[/api/dtmf/menus/:id] Update error:', error);
      return NextResponse.json(
        { error: 'Failed to update DTMF menu', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'DTMF menu not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'DTMF menu updated successfully',
    });
  } catch (error: unknown) {
    console.error('[/api/dtmf/menus/:id] Error:', error);
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
 * DELETE /api/dtmf/menus/:id
 * Delete a DTMF menu
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id') || 'default';

    const { error } = await supabase
      .from('dtmf_menus')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[/api/dtmf/menus/:id] Delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete DTMF menu', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'DTMF menu deleted successfully',
      id,
    });
  } catch (error: unknown) {
    console.error('[/api/dtmf/menus/:id] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
