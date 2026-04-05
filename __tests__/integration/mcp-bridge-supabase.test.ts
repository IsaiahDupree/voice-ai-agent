// Feature 161: Integration test: MCP bridge calls Supabase execute_sql
/**
 * Integration test for MCP bridge calling Supabase MCP server
 * Verifies that callMCPTool can execute SQL queries via Supabase MCP
 */

import { createMocks } from 'node-mocks-http'
import { POST as mcpBridgeHandler } from '@/app/api/tools/mcp-bridge/route'
import { supabaseAdmin } from '@/lib/supabase'

describe('MCP Bridge - Supabase Integration', () => {
  const testTenantId = 'test-mcp-bridge-tenant'
  let mcpRegistryId: string

  beforeAll(async () => {
    // Register Supabase MCP server for test tenant
    const { data, error } = await supabaseAdmin
      .from('mcp_registry')
      .insert({
        tenant_id: testTenantId,
        server_name: 'supabase',
        server_url: process.env.SUPABASE_MCP_SERVER_URL || 'http://localhost:3100/mcp',
        auth_type: 'api_key',
        auth_config: {
          api_key: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        },
        enabled_tools: ['execute_sql', 'list_tables'],
        status: 'active',
      })
      .select('id')
      .single()

    if (!error && data) {
      mcpRegistryId = data.id
    }
  })

  afterAll(async () => {
    // Clean up test MCP registry entry
    if (mcpRegistryId) {
      await supabaseAdmin
        .from('mcp_registry')
        .delete()
        .eq('id', mcpRegistryId)
    }
  })

  it('should call Supabase execute_sql via MCP bridge', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-current-tenant-id': testTenantId,
      },
      body: {
        server: 'supabase',
        tool: 'execute_sql',
        params: {
          query: 'SELECT 1 AS test_value',
        },
        tenant_id: testTenantId,
      },
    })

    const response = await mcpBridgeHandler(req as any)
    const responseData = await response.json()

    expect(response.status).toBe(200)
    expect(responseData.success).toBe(true)
    expect(responseData.server).toBe('supabase')
    expect(responseData.tool).toBe('execute_sql')
    expect(responseData.result).toBeTruthy()
  })

  it('should query actual tables via MCP bridge', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-current-tenant-id': testTenantId,
      },
      body: {
        server: 'supabase',
        tool: 'execute_sql',
        params: {
          query: 'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' LIMIT 5',
        },
        tenant_id: testTenantId,
      },
    })

    const response = await mcpBridgeHandler(req as any)
    const responseData = await response.json()

    expect(response.status).toBe(200)
    expect(responseData.success).toBe(true)
    expect(responseData.result).toBeTruthy()

    // Result should contain array of tables
    if (Array.isArray(responseData.result)) {
      expect(responseData.result.length).toBeGreaterThan(0)
    }
  })

  it('should return error for invalid SQL', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-current-tenant-id': testTenantId,
      },
      body: {
        server: 'supabase',
        tool: 'execute_sql',
        params: {
          query: 'INVALID SQL SYNTAX HERE',
        },
        tenant_id: testTenantId,
      },
    })

    const response = await mcpBridgeHandler(req as any)
    const responseData = await response.json()

    // Should fail gracefully with error message
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(responseData.success).toBeFalsy()
    expect(responseData.error).toBeTruthy()
  })

  it('should return error for non-existent MCP server', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-current-tenant-id': testTenantId,
      },
      body: {
        server: 'non-existent-server',
        tool: 'some_tool',
        params: {},
        tenant_id: testTenantId,
      },
    })

    const response = await mcpBridgeHandler(req as any)
    const responseData = await response.json()

    expect(response.status).toBe(404)
    expect(responseData.error).toContain('not found')
  })

  it('should require server and tool parameters', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-current-tenant-id': testTenantId,
      },
      body: {
        // Missing server and tool
        params: {},
        tenant_id: testTenantId,
      },
    })

    const response = await mcpBridgeHandler(req as any)
    const responseData = await response.json()

    expect(response.status).toBe(400)
    expect(responseData.error).toContain('required')
  })

  it('should isolate MCP registry by tenant', async () => {
    // Try to access Supabase MCP registered to testTenantId from a different tenant
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-current-tenant-id': 'different-tenant',
      },
      body: {
        server: 'supabase',
        tool: 'execute_sql',
        params: {
          query: 'SELECT 1',
        },
        tenant_id: 'different-tenant',
      },
    })

    const response = await mcpBridgeHandler(req as any)
    const responseData = await response.json()

    // Should fail because supabase server is only registered for testTenantId
    expect(response.status).toBe(404)
    expect(responseData.error).toContain('not found')
  })
})
