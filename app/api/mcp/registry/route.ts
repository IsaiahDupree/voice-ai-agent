/**
 * Features 151-152: MCP Registry Management
 * GET /api/mcp/registry - List registered MCP servers
 * POST /api/mcp/registry - Register new MCP server
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateMCPConnection } from '@/lib/mcp-client'

/**
 * Feature 151: List all registered MCP servers for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id') || 'default'
    const status = searchParams.get('status') // Optional filter

    let query = supabaseAdmin
      .from('mcp_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('server_name')

    if (status) {
      query = query.eq('status', status)
    }

    const { data: servers, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      servers: servers || [],
      count: servers?.length || 0,
    })
  } catch (error: any) {
    console.error('Error in GET /api/mcp/registry:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Feature 152: Register new MCP server
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      tenant_id,
      server_name,
      server_url,
      auth_type,
      auth_config,
      enabled_tools,
      test_connection,
    } = body

    // Validate required fields
    if (!tenant_id || !server_name || !server_url) {
      return NextResponse.json(
        {
          error: 'tenant_id, server_name, and server_url are required',
        },
        { status: 400 }
      )
    }

    // Validate server_name format (lowercase, alphanumeric, hyphens, underscores)
    const namePattern = /^[a-z0-9-_]+$/
    if (!namePattern.test(server_name)) {
      return NextResponse.json(
        {
          error:
            'server_name must be lowercase alphanumeric with hyphens/underscores only',
        },
        { status: 400 }
      )
    }

    // Check if server already exists
    const { data: existing } = await supabaseAdmin
      .from('mcp_registry')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('server_name', server_name)
      .single()

    if (existing) {
      return NextResponse.json(
        {
          error: `MCP server '${server_name}' already registered for this tenant`,
        },
        { status: 409 }
      )
    }

    // Test connection if requested
    let connectionValid = true
    let availableTools: any[] = []
    let connectionError: string | undefined

    if (test_connection !== false) {
      // Default to testing connection
      const testResult = await validateMCPConnection({
        server_name,
        server_url,
        auth_type: auth_type || 'none',
        auth_config: auth_config || {},
        enabled_tools: enabled_tools || [],
      })

      connectionValid = testResult.valid
      availableTools = testResult.tools
      connectionError = testResult.error

      if (!connectionValid) {
        return NextResponse.json(
          {
            error: 'MCP server connection test failed',
            details: connectionError,
          },
          { status: 400 }
        )
      }
    }

    // Register server
    const { data: server, error } = await supabaseAdmin
      .from('mcp_registry')
      .insert({
        tenant_id,
        server_name,
        server_url,
        auth_type: auth_type || 'none',
        auth_config: auth_config || {},
        enabled_tools: enabled_tools || [],
        status: 'active',
        health_status: connectionValid ? 'healthy' : 'unknown',
        last_health_check_at: connectionValid ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error registering MCP server:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        server,
        available_tools: availableTools,
        message: 'MCP server registered successfully',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error in POST /api/mcp/registry:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Update MCP server configuration
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, tenant_id, ...updates } = body

    if (!id || !tenant_id) {
      return NextResponse.json(
        { error: 'id and tenant_id are required' },
        { status: 400 }
      )
    }

    // Don't allow updating server_name (it's a key identifier)
    delete updates.server_name

    const { data: server, error } = await supabaseAdmin
      .from('mcp_registry')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating MCP server:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!server) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      server,
      message: 'MCP server updated successfully',
    })
  } catch (error: any) {
    console.error('Error in PATCH /api/mcp/registry:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
