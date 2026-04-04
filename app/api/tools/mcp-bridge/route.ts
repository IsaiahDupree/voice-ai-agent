/**
 * Feature 150: MCP Tool Bridge
 * POST /api/tools/mcp-bridge
 *
 * Vapi function tool entry point for calling any registered MCP server
 * Agent passes: { server: "supabase", tool: "execute_sql", params: {...} }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { callMCPTool, checkMCPServerHealth } from '@/lib/mcp-client'

/**
 * Call an MCP tool via the bridge
 * This is called by Vapi as a function tool during a call
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { server, tool, params, tenant_id } = body

    // Validate required fields
    if (!server || !tool) {
      return NextResponse.json(
        { error: 'server and tool are required' },
        { status: 400 }
      )
    }

    // Resolve tenant_id (from request body, header, or default)
    const resolvedTenantId =
      tenant_id ||
      request.headers.get('x-current-tenant-id') ||
      request.headers.get('x-tenant-id') ||
      'default'

    // Look up MCP server in registry
    const { data: mcpServer, error: lookupError } = await supabaseAdmin
      .from('mcp_registry')
      .select('*')
      .eq('tenant_id', resolvedTenantId)
      .eq('server_name', server)
      .eq('status', 'active')
      .single()

    if (lookupError || !mcpServer) {
      return NextResponse.json(
        {
          error: `MCP server '${server}' not found or not active for tenant`,
        },
        { status: 404 }
      )
    }

    // Call the MCP tool
    const result = await callMCPTool(
      {
        server_name: mcpServer.server_name,
        server_url: mcpServer.server_url,
        auth_type: mcpServer.auth_type,
        auth_config: mcpServer.auth_config,
        enabled_tools: mcpServer.enabled_tools || [],
      },
      tool,
      params || {}
    )

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          server,
          tool,
        },
        { status: 500 }
      )
    }

    // Log successful call (optional, for debugging)
    console.log(`[MCP Bridge] ${server}.${tool} called successfully`)

    return NextResponse.json({
      success: true,
      result: result.result,
      server,
      tool,
    })
  } catch (error: any) {
    console.error('Error in MCP bridge:', error)
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * Get available MCP servers and tools (for debugging/testing)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id') || 'default'
    const serverName = searchParams.get('server')

    // If specific server requested, return its details
    if (serverName) {
      const { data: mcpServer, error } = await supabaseAdmin
        .from('mcp_registry')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('server_name', serverName)
        .single()

      if (error || !mcpServer) {
        return NextResponse.json(
          { error: `MCP server '${serverName}' not found` },
          { status: 404 }
        )
      }

      // Check health
      const health = await checkMCPServerHealth({
        server_name: mcpServer.server_name,
        server_url: mcpServer.server_url,
        auth_type: mcpServer.auth_type,
        auth_config: mcpServer.auth_config,
        enabled_tools: mcpServer.enabled_tools || [],
      })

      return NextResponse.json({
        server: {
          name: mcpServer.server_name,
          url: mcpServer.server_url,
          status: mcpServer.status,
          enabled_tools: mcpServer.enabled_tools,
        },
        health,
      })
    }

    // List all MCP servers for tenant
    const { data: servers, error } = await supabaseAdmin
      .from('mcp_registry')
      .select('id, server_name, server_url, status, enabled_tools, last_health_check_at')
      .eq('tenant_id', tenantId)
      .order('server_name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      servers: servers || [],
      count: servers?.length || 0,
    })
  } catch (error: any) {
    console.error('Error in GET /api/tools/mcp-bridge:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
