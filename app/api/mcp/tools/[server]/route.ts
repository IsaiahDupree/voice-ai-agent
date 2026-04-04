/**
 * Feature 155: List available tools for an MCP server
 * GET /api/mcp/tools/:server
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCachedMCPTools } from '@/lib/mcp-client'

/**
 * List all available tools for a specific MCP server
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { server: string } }
) {
  try {
    const { server: serverName } = params
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id') || 'default'
    const refresh = searchParams.get('refresh') === 'true' // Force refresh cache

    // Look up MCP server
    const { data: mcpServer, error: lookupError } = await supabaseAdmin
      .from('mcp_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('server_name', serverName)
      .single()

    if (lookupError || !mcpServer) {
      return NextResponse.json(
        { error: `MCP server '${serverName}' not found` },
        { status: 404 }
      )
    }

    // Get tools (cached unless refresh requested)
    const tools = await getCachedMCPTools({
      server_name: mcpServer.server_name,
      server_url: mcpServer.server_url,
      auth_type: mcpServer.auth_type,
      auth_config: mcpServer.auth_config,
      enabled_tools: mcpServer.enabled_tools || [],
    })

    // Filter by enabled_tools whitelist
    const enabledTools =
      mcpServer.enabled_tools.length > 0
        ? tools.filter((t) => mcpServer.enabled_tools.includes(t.name))
        : tools

    return NextResponse.json({
      server: {
        name: mcpServer.server_name,
        url: mcpServer.server_url,
        status: mcpServer.status,
      },
      tools: enabledTools,
      total_available: tools.length,
      enabled_count: enabledTools.length,
      filtered: mcpServer.enabled_tools.length > 0,
    })
  } catch (error: any) {
    console.error('Error in GET /api/mcp/tools/:server:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
