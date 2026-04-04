/**
 * Features 147-149: MCP Protocol Client
 * Implements MCP (Model Context Protocol) client for calling external MCP servers
 *
 * MCP Protocol: JSON-RPC 2.0 over HTTP
 * Supports: connect, list-tools, call-tool, auth (api_key, bearer_token, basic)
 */

interface MCPServerConfig {
  server_name: string
  server_url: string
  auth_type: 'none' | 'api_key' | 'bearer_token' | 'basic'
  auth_config: Record<string, any>
  enabled_tools: string[]
}

interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, any>
}

interface MCPCallResult {
  success: boolean
  result?: any
  error?: string
}

/**
 * Feature 147: Connect to MCP server and list available tools
 */
export async function listMCPTools(
  config: MCPServerConfig
): Promise<MCPTool[]> {
  try {
    const headers = buildAuthHeaders(config)

    const response = await fetch(`${config.server_url}/mcp/v1/tools/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list',
        params: {},
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`MCP Error: ${data.error.message}`)
    }

    return data.result.tools || []
  } catch (error: any) {
    console.error(`Error listing MCP tools from ${config.server_name}:`, error)
    throw error
  }
}

/**
 * Feature 148: Call a specific tool on an MCP server with JSON-RPC
 */
export async function callMCPTool(
  config: MCPServerConfig,
  toolName: string,
  params: Record<string, any>
): Promise<MCPCallResult> {
  try {
    // Validate tool is in whitelist
    if (
      config.enabled_tools.length > 0 &&
      !config.enabled_tools.includes(toolName)
    ) {
      return {
        success: false,
        error: `Tool '${toolName}' is not enabled for server '${config.server_name}'`,
      }
    }

    const headers = buildAuthHeaders(config)

    const response = await fetch(`${config.server_url}/mcp/v1/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: params,
        },
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()

    if (data.error) {
      return {
        success: false,
        error: `MCP Error: ${data.error.message}`,
      }
    }

    return {
      success: true,
      result: data.result,
    }
  } catch (error: any) {
    console.error(`Error calling MCP tool ${toolName}:`, error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Feature 149: Build auth headers based on auth_type
 */
function buildAuthHeaders(config: MCPServerConfig): Record<string, string> {
  const headers: Record<string, string> = {}

  switch (config.auth_type) {
    case 'api_key':
      // API key can be in header or query param
      const apiKeyHeader = config.auth_config.header_name || 'X-API-Key'
      headers[apiKeyHeader] = config.auth_config.api_key
      break

    case 'bearer_token':
      headers['Authorization'] = `Bearer ${config.auth_config.token}`
      break

    case 'basic':
      const credentials = Buffer.from(
        `${config.auth_config.username}:${config.auth_config.password}`
      ).toString('base64')
      headers['Authorization'] = `Basic ${credentials}`
      break

    case 'none':
    default:
      // No auth headers needed
      break
  }

  return headers
}

/**
 * Health check for an MCP server
 */
export async function checkMCPServerHealth(
  config: MCPServerConfig
): Promise<{
  healthy: boolean
  latency_ms: number
  error?: string
  available_tools?: number
}> {
  const start = Date.now()

  try {
    const tools = await listMCPTools(config)
    const latency = Date.now() - start

    return {
      healthy: true,
      latency_ms: latency,
      available_tools: tools.length,
    }
  } catch (error: any) {
    const latency = Date.now() - start

    return {
      healthy: false,
      latency_ms: latency,
      error: error.message,
    }
  }
}

/**
 * Validate MCP server connection
 */
export async function validateMCPConnection(
  config: MCPServerConfig
): Promise<{
  valid: boolean
  tools: MCPTool[]
  error?: string
}> {
  try {
    const tools = await listMCPTools(config)

    return {
      valid: true,
      tools,
    }
  } catch (error: any) {
    return {
      valid: false,
      tools: [],
      error: error.message,
    }
  }
}

/**
 * Get cached tools for an MCP server (to avoid repeated list-tools calls)
 */
const toolsCache = new Map<string, { tools: MCPTool[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getCachedMCPTools(
  config: MCPServerConfig
): Promise<MCPTool[]> {
  const cacheKey = `${config.server_name}-${config.server_url}`
  const cached = toolsCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.tools
  }

  const tools = await listMCPTools(config)
  toolsCache.set(cacheKey, { tools, timestamp: Date.now() })

  return tools
}

/**
 * Clear tools cache for a specific server
 */
export function clearMCPToolsCache(serverName: string) {
  for (const [key] of toolsCache) {
    if (key.startsWith(serverName)) {
      toolsCache.delete(key)
    }
  }
}
