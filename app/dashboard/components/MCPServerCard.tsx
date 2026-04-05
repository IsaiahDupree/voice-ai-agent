/**
 * Feature 160: MCPServerCard component
 * Shows MCP server status, configuration, and available tools
 */

'use client'

import { useState, useEffect } from 'react'

interface MCPServer {
  id: number
  tenant_id: string
  server_name: string
  server_url: string
  auth_type: 'none' | 'api_key' | 'bearer_token' | 'basic'
  auth_config: Record<string, any>
  enabled_tools: string[]
  status: 'active' | 'inactive' | 'error'
  health_status: 'healthy' | 'unhealthy' | 'unknown'
  last_health_check_at: string | null
  created_at: string
  updated_at: string
}

interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, any>
}

interface MCPServerCardProps {
  server: MCPServer
  onDelete?: (serverId: number) => void
  onToggleStatus?: (serverId: number, newStatus: 'active' | 'inactive') => void
  onRefreshHealth?: (serverId: number) => void
}

export default function MCPServerCard({
  server,
  onDelete,
  onToggleStatus,
  onRefreshHealth,
}: MCPServerCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [tools, setTools] = useState<MCPTool[]>([])
  const [loadingTools, setLoadingTools] = useState(false)
  const [toolsError, setToolsError] = useState<string | null>(null)

  // Load tools when expanded
  useEffect(() => {
    if (expanded && tools.length === 0) {
      fetchTools()
    }
  }, [expanded])

  async function fetchTools() {
    try {
      setLoadingTools(true)
      setToolsError(null)

      const response = await fetch(
        `/api/mcp/tools/${server.server_name}?tenant_id=${server.tenant_id}`
      )
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setTools(data.tools || [])
    } catch (err: any) {
      console.error('Error fetching MCP tools:', err)
      setToolsError(err.message)
    } finally {
      setLoadingTools(false)
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  function getHealthColor(health: string): string {
    switch (health) {
      case 'healthy':
        return 'bg-green-500'
      case 'unhealthy':
        return 'bg-red-500'
      case 'unknown':
      default:
        return 'bg-gray-400'
    }
  }

  function getAuthTypeLabel(authType: string): string {
    switch (authType) {
      case 'api_key':
        return 'API Key'
      case 'bearer_token':
        return 'Bearer Token'
      case 'basic':
        return 'Basic Auth'
      case 'none':
      default:
        return 'None'
    }
  }

  return (
    <div className="border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {/* Health indicator dot */}
              <div
                className={`w-3 h-3 rounded-full ${getHealthColor(server.health_status)}`}
                title={`Health: ${server.health_status}`}
              />
              <h3 className="text-lg font-semibold">{server.server_name}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">{server.server_url}</p>
          </div>

          {/* Status badge */}
          <span
            className={`px-3 py-1 text-xs font-medium rounded border ${getStatusColor(server.status)}`}
          >
            {server.status.toUpperCase()}
          </span>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
          <div>
            <span className="font-medium">Auth:</span> {getAuthTypeLabel(server.auth_type)}
          </div>
          <div>
            <span className="font-medium">Enabled Tools:</span>{' '}
            {server.enabled_tools.length === 0 ? 'All' : server.enabled_tools.length}
          </div>
          {server.last_health_check_at && (
            <div>
              <span className="font-medium">Last Check:</span>{' '}
              {new Date(server.last_health_check_at).toLocaleString()}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            {expanded ? 'Hide Tools' : 'Show Tools'}
          </button>

          {onRefreshHealth && (
            <button
              onClick={() => onRefreshHealth(server.id)}
              className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded hover:bg-gray-300"
              title="Refresh health status"
            >
              🔄 Refresh
            </button>
          )}

          {onToggleStatus && (
            <button
              onClick={() =>
                onToggleStatus(server.id, server.status === 'active' ? 'inactive' : 'active')
              }
              className={`px-4 py-2 text-sm rounded ${
                server.status === 'active'
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                  : 'bg-green-100 text-green-800 hover:bg-green-200'
              }`}
            >
              {server.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          )}

          {onDelete && (
            <button
              onClick={() => {
                if (confirm(`Delete MCP server "${server.server_name}"?`)) {
                  onDelete(server.id)
                }
              }}
              className="px-4 py-2 bg-red-100 text-red-800 text-sm rounded hover:bg-red-200"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Expanded tools section */}
      {expanded && (
        <div className="border-t bg-gray-50 p-4">
          <h4 className="font-semibold mb-3">Available Tools</h4>

          {loadingTools && (
            <div className="text-center py-4 text-gray-600">Loading tools...</div>
          )}

          {toolsError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              Error loading tools: {toolsError}
            </div>
          )}

          {!loadingTools && !toolsError && tools.length === 0 && (
            <div className="text-center py-4 text-gray-600">No tools available</div>
          )}

          {!loadingTools && !toolsError && tools.length > 0 && (
            <div className="space-y-2">
              {tools.map((tool) => (
                <div key={tool.name} className="bg-white border rounded p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-mono text-sm font-semibold text-blue-600">
                        {tool.name}
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{tool.description}</p>

                      {/* Input schema summary */}
                      {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                            Input Schema
                          </summary>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(tool.inputSchema, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>

                    {/* Enabled indicator */}
                    {server.enabled_tools.length > 0 && (
                      <span
                        className={`ml-2 px-2 py-1 text-xs rounded ${
                          server.enabled_tools.includes(tool.name)
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {server.enabled_tools.includes(tool.name) ? 'Enabled' : 'Disabled'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
