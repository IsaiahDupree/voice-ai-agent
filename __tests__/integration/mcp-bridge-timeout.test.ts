// Feature 162: Integration test: MCP bridge handles server timeout gracefully
/**
 * Integration test for MCP bridge timeout handling
 * Verifies that the bridge fails gracefully when MCP server is slow or unresponsive
 */

import { createMocks } from 'node-mocks-http'
import { POST as mcpBridgeHandler } from '@/app/api/tools/mcp-bridge/route'
import { supabaseAdmin } from '@/lib/supabase'

describe('MCP Bridge - Timeout Handling', () => {
  const testTenantId = 'test-mcp-timeout-tenant'
  let slowServerRegistryId: string

  beforeAll(async () => {
    // Register a mock slow/unresponsive MCP server
    const { data, error } = await supabaseAdmin
      .from('mcp_registry')
      .insert({
        tenant_id: testTenantId,
        server_name: 'slow-server',
        server_url: 'http://localhost:9999/mcp', // Non-existent port to simulate timeout
        auth_type: 'none',
        auth_config: {},
        enabled_tools: ['slow_tool'],
        status: 'active',
      })
      .select('id')
      .single()

    if (!error && data) {
      slowServerRegistryId = data.id
    }
  })

  afterAll(async () => {
    // Clean up test MCP registry entry
    if (slowServerRegistryId) {
      await supabaseAdmin
        .from('mcp_registry')
        .delete()
        .eq('id', slowServerRegistryId)
    }
  })

  it('should timeout gracefully when MCP server is unreachable', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-current-tenant-id': testTenantId,
      },
      body: {
        server: 'slow-server',
        tool: 'slow_tool',
        params: {},
        tenant_id: testTenantId,
      },
    })

    const startTime = Date.now()
    const response = await mcpBridgeHandler(req as any)
    const endTime = Date.now()
    const duration = endTime - startTime

    const responseData = await response.json()

    // Should fail with error
    expect(response.status).toBeGreaterThanOrEqual(500)
    expect(responseData.success).toBeFalsy()
    expect(responseData.error).toBeTruthy()

    // Should timeout within reasonable time (e.g., < 10 seconds)
    expect(duration).toBeLessThan(10000)
  })

  it('should return structured error on timeout', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-current-tenant-id': testTenantId,
      },
      body: {
        server: 'slow-server',
        tool: 'slow_tool',
        params: {},
        tenant_id: testTenantId,
      },
    })

    const response = await mcpBridgeHandler(req as any)
    const responseData = await response.json()

    expect(responseData).toHaveProperty('error')
    expect(responseData).toHaveProperty('server')
    expect(responseData).toHaveProperty('tool')

    expect(responseData.server).toBe('slow-server')
    expect(responseData.tool).toBe('slow_tool')

    // Error message should indicate connection or timeout issue
    expect(responseData.error).toMatch(/timeout|connect|ECONNREFUSED/i)
  })

  it('should not crash the API route on timeout', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-current-tenant-id': testTenantId,
      },
      body: {
        server: 'slow-server',
        tool: 'slow_tool',
        params: {},
        tenant_id: testTenantId,
      },
    })

    // Should not throw unhandled exception
    let didThrow = false
    try {
      const response = await mcpBridgeHandler(req as any)
      const responseData = await response.json()

      // Response should be valid JSON
      expect(responseData).toBeTruthy()
    } catch (error) {
      didThrow = true
    }

    expect(didThrow).toBe(false)
  })

  it('should work with subsequent requests after timeout', async () => {
    // First request: timeout
    const { req: req1 } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-current-tenant-id': testTenantId,
      },
      body: {
        server: 'slow-server',
        tool: 'slow_tool',
        params: {},
        tenant_id: testTenantId,
      },
    })

    await mcpBridgeHandler(req1 as any)

    // Second request: should still process (not permanently broken)
    const { req: req2 } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-current-tenant-id': testTenantId,
      },
      body: {
        server: 'slow-server',
        tool: 'slow_tool',
        params: {},
        tenant_id: testTenantId,
      },
    })

    const response2 = await mcpBridgeHandler(req2 as any)
    const responseData2 = await response2.json()

    // Should still return structured error (not broken/hanging)
    expect(responseData2).toBeTruthy()
    expect(responseData2).toHaveProperty('error')
  })

  it('should handle malformed MCP server URL', async () => {
    // Register server with invalid URL
    const { data: badServer } = await supabaseAdmin
      .from('mcp_registry')
      .insert({
        tenant_id: testTenantId,
        server_name: 'bad-url-server',
        server_url: 'not-a-valid-url',
        auth_type: 'none',
        auth_config: {},
        enabled_tools: ['test_tool'],
        status: 'active',
      })
      .select('id')
      .single()

    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-current-tenant-id': testTenantId,
      },
      body: {
        server: 'bad-url-server',
        tool: 'test_tool',
        params: {},
        tenant_id: testTenantId,
      },
    })

    const response = await mcpBridgeHandler(req as any)
    const responseData = await response.json()

    // Should fail gracefully
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(responseData.error).toBeTruthy()

    // Clean up
    if (badServer) {
      await supabaseAdmin
        .from('mcp_registry')
        .delete()
        .eq('id', badServer.id)
    }
  })
})
