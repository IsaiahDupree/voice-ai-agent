/**
 * Feature 154: Test MCP tool call
 * POST /api/mcp/test - Test calling a specific tool on an MCP server
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { callMCPTool } from '@/lib/mcp-client'

/**
 * Test calling a specific MCP tool
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenant_id, server_name, tool_name, params } = body

    if (!tenant_id || !server_name || !tool_name) {
      return NextResponse.json(
        {
          error: 'tenant_id, server_name, and tool_name are required',
        },
        { status: 400 }
      )
    }

    // Look up MCP server
    const { data: mcpServer, error: lookupError } = await supabaseAdmin
      .from('mcp_registry')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('server_name', server_name)
      .single()

    if (lookupError || !mcpServer) {
      return NextResponse.json(
        { error: `MCP server '${server_name}' not found` },
        { status: 404 }
      )
    }

    // Call the tool
    const startTime = Date.now()

    const result = await callMCPTool(
      {
        server_name: mcpServer.server_name,
        server_url: mcpServer.server_url,
        auth_type: mcpServer.auth_type,
        auth_config: mcpServer.auth_config,
        enabled_tools: mcpServer.enabled_tools || [],
      },
      tool_name,
      params || {}
    )

    const latency = Date.now() - startTime

    return NextResponse.json({
      test_result: {
        success: result.success,
        result: result.result,
        error: result.error,
        latency_ms: latency,
      },
      server: {
        name: mcpServer.server_name,
        url: mcpServer.server_url,
      },
      tool: tool_name,
      params,
    })
  } catch (error: any) {
    console.error('Error in POST /api/mcp/test:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
