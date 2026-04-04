/**
 * Feature 153: Delete MCP server registration
 * DELETE /api/mcp/registry/:id
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { clearMCPToolsCache } from '@/lib/mcp-client'

/**
 * Get specific MCP server details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id') || 'default'

    const { data: server, error } = await supabaseAdmin
      .from('mcp_registry')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !server) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ server })
  } catch (error: any) {
    console.error('Error in GET /api/mcp/registry/:id:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Feature 153: Delete MCP server registration
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id') || 'default'

    // Get server name before deleting (to clear cache)
    const { data: server } = await supabaseAdmin
      .from('mcp_registry')
      .select('server_name')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (!server) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      )
    }

    // Delete server
    const { error } = await supabaseAdmin
      .from('mcp_registry')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) {
      console.error('Error deleting MCP server:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Clear tools cache for this server
    clearMCPToolsCache(server.server_name)

    return NextResponse.json({
      message: 'MCP server deleted successfully',
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/mcp/registry/:id:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Update specific MCP server
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { tenant_id, ...updates } = body

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      )
    }

    // Don't allow updating server_name
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

    // Clear cache when server config changes
    clearMCPToolsCache(server.server_name)

    return NextResponse.json({
      server,
      message: 'MCP server updated successfully',
    })
  } catch (error: any) {
    console.error('Error in PATCH /api/mcp/registry/:id:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
