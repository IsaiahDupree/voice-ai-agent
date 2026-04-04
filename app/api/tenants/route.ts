/**
 * Feature 130-131: Multi-Tenant Management API
 * POST /api/tenants - Create new tenant
 * GET /api/tenants - List all tenants (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Feature 130: Create tenant
 * POST /api/tenants
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, phone_numbers, plan, settings } = body

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    // Validate slug format (lowercase, alphanumeric, hyphens only)
    const slugPattern = /^[a-z0-9-]+$/
    if (!slugPattern.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must be lowercase alphanumeric with hyphens only' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const { data: existingTenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingTenant) {
      return NextResponse.json(
        { error: 'Tenant with this slug already exists' },
        { status: 409 }
      )
    }

    // Create tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        name,
        slug,
        phone_numbers: phone_numbers || [],
        plan: plan || 'free',
        settings: settings || {},
      })
      .select()
      .single()

    if (tenantError) {
      console.error('Error creating tenant:', tenantError)
      return NextResponse.json(
        { error: tenantError.message },
        { status: 500 }
      )
    }

    // Create default tenant_config
    const { data: config, error: configError } = await supabaseAdmin
      .from('tenant_configs')
      .insert({
        tenant_id: tenant.id,
        kb_namespace: slug, // Use slug as KB namespace
        timezone: 'America/New_York',
      })
      .select()
      .single()

    if (configError) {
      console.error('Error creating tenant config:', configError)
      // Rollback tenant creation if config fails
      await supabaseAdmin.from('tenants').delete().eq('id', tenant.id)
      return NextResponse.json(
        { error: 'Failed to create tenant configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        tenant,
        config,
        message: 'Tenant created successfully',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error in POST /api/tenants:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Feature 131: List all tenants (admin only)
 * GET /api/tenants
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('id')
    const slug = searchParams.get('slug')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get specific tenant by ID
    if (tenantId) {
      const { data: tenant, error } = await supabaseAdmin
        .from('tenants')
        .select('*, tenant_configs(*)')
        .eq('id', tenantId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Tenant not found' },
            { status: 404 }
          )
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ tenant })
    }

    // Get specific tenant by slug
    if (slug) {
      const { data: tenant, error } = await supabaseAdmin
        .from('tenants')
        .select('*, tenant_configs(*)')
        .eq('slug', slug)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Tenant not found' },
            { status: 404 }
          )
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ tenant })
    }

    // List all tenants with pagination
    const offset = (page - 1) * limit

    const { data: tenants, error, count } = await supabaseAdmin
      .from('tenants')
      .select('*, tenant_configs(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error listing tenants:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      tenants: tenants || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/tenants:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Update tenant
 * PATCH /api/tenants
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      )
    }

    // Don't allow updating id or slug
    delete updates.slug

    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating tenant:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tenant })
  } catch (error: any) {
    console.error('Error in PATCH /api/tenants:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Delete tenant
 * DELETE /api/tenants
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      )
    }

    // Prevent deleting default tenant
    if (id === 'default') {
      return NextResponse.json(
        { error: 'Cannot delete default tenant' },
        { status: 403 }
      )
    }

    const { error } = await supabaseAdmin
      .from('tenants')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting tenant:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Tenant deleted successfully' })
  } catch (error: any) {
    console.error('Error in DELETE /api/tenants:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
