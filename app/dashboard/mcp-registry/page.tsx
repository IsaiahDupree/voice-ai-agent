/**
 * Feature 159: MCP Registry Dashboard
 * View and manage registered MCP servers and their tools
 */

'use client'

import { useState, useEffect } from 'react'
import MCPServerCard from '../components/MCPServerCard'

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

export default function MCPRegistryPage() {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState('default')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Registration form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    server_name: '',
    server_url: '',
    auth_type: 'none' as 'none' | 'api_key' | 'bearer_token' | 'basic',
    auth_config: {} as Record<string, any>,
    enabled_tools: [] as string[],
  })
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    fetchServers()
  }, [tenantId, statusFilter])

  async function fetchServers() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        tenant_id: tenantId,
      })

      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }

      const response = await fetch(`/api/mcp/registry?${params}`)
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setServers(data.servers || [])
    } catch (err: any) {
      console.error('Error fetching MCP servers:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegisterServer() {
    try {
      setRegistering(true)
      setError(null)

      const response = await fetch('/api/mcp/registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          ...formData,
          test_connection: true, // Always test connection before registering
        }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Reset form and refresh
      setFormData({
        server_name: '',
        server_url: '',
        auth_type: 'none',
        auth_config: {},
        enabled_tools: [],
      })
      setShowAddForm(false)
      await fetchServers()

      alert(`Server registered successfully! Found ${data.available_tools?.length || 0} tools.`)
    } catch (err: any) {
      console.error('Error registering server:', err)
      setError(err.message)
    } finally {
      setRegistering(false)
    }
  }

  async function handleDeleteServer(serverId: number) {
    try {
      const response = await fetch(`/api/mcp/registry/${serverId}?tenant_id=${tenantId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      await fetchServers()
    } catch (err: any) {
      console.error('Error deleting server:', err)
      setError(err.message)
    }
  }

  async function handleToggleStatus(serverId: number, newStatus: 'active' | 'inactive') {
    try {
      const response = await fetch('/api/mcp/registry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: serverId,
          tenant_id: tenantId,
          status: newStatus,
        }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      await fetchServers()
    } catch (err: any) {
      console.error('Error toggling server status:', err)
      setError(err.message)
    }
  }

  async function handleRefreshHealth(serverId: number) {
    try {
      // Test the MCP server and update health status
      const response = await fetch('/api/mcp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_id: serverId,
          tenant_id: tenantId,
        }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Update health status in registry
      await fetch('/api/mcp/registry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: serverId,
          tenant_id: tenantId,
          health_status: data.healthy ? 'healthy' : 'unhealthy',
          last_health_check_at: new Date().toISOString(),
        }),
      })

      await fetchServers()
    } catch (err: any) {
      console.error('Error refreshing health:', err)
      setError(err.message)
    }
  }

  function updateAuthConfig(key: string, value: string) {
    setFormData({
      ...formData,
      auth_config: {
        ...formData.auth_config,
        [key]: value,
      },
    })
  }

  const filteredServers =
    statusFilter === 'all' ? servers : servers.filter((s) => s.status === statusFilter)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">MCP Server Registry</h1>
        <p className="text-gray-600">
          Manage Model Context Protocol (MCP) servers and their available tools
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between gap-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tenant</label>
              <input
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="px-3 py-2 border rounded"
                placeholder="default"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
                }
                className="px-3 py-2 border rounded"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Add button */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {showAddForm ? 'Cancel' : '+ Register Server'}
          </button>
        </div>
      </div>

      {/* Registration form */}
      {showAddForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Register MCP Server</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Server Name *</label>
                <input
                  type="text"
                  value={formData.server_name}
                  onChange={(e) =>
                    setFormData({ ...formData, server_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  placeholder="supabase"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lowercase alphanumeric with hyphens/underscores only
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Server URL *</label>
                <input
                  type="text"
                  value={formData.server_url}
                  onChange={(e) =>
                    setFormData({ ...formData, server_url: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  placeholder="https://mcp.example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Authentication Type</label>
              <select
                value={formData.auth_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    auth_type: e.target.value as
                      | 'none'
                      | 'api_key'
                      | 'bearer_token'
                      | 'basic',
                    auth_config: {}, // Reset auth config when type changes
                  })
                }
                className="w-full px-3 py-2 border rounded"
              >
                <option value="none">None</option>
                <option value="api_key">API Key</option>
                <option value="bearer_token">Bearer Token</option>
                <option value="basic">Basic Auth</option>
              </select>
            </div>

            {/* Auth config fields based on auth_type */}
            {formData.auth_type === 'api_key' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    API Key Header Name
                  </label>
                  <input
                    type="text"
                    value={formData.auth_config.header_name || ''}
                    onChange={(e) => updateAuthConfig('header_name', e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="X-API-Key"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">API Key</label>
                  <input
                    type="password"
                    value={formData.auth_config.api_key || ''}
                    onChange={(e) => updateAuthConfig('api_key', e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="sk-..."
                  />
                </div>
              </div>
            )}

            {formData.auth_type === 'bearer_token' && (
              <div>
                <label className="block text-sm font-medium mb-2">Bearer Token</label>
                <input
                  type="password"
                  value={formData.auth_config.token || ''}
                  onChange={(e) => updateAuthConfig('token', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="eyJ..."
                />
              </div>
            )}

            {formData.auth_type === 'basic' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Username</label>
                  <input
                    type="text"
                    value={formData.auth_config.username || ''}
                    onChange={(e) => updateAuthConfig('username', e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={formData.auth_config.password || ''}
                    onChange={(e) => updateAuthConfig('password', e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="********"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Enabled Tools (comma-separated, leave empty for all)
              </label>
              <input
                type="text"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    enabled_tools: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full px-3 py-2 border rounded"
                placeholder="execute_sql, get_table_schema"
              />
            </div>

            <button
              onClick={handleRegisterServer}
              disabled={
                registering || !formData.server_name || !formData.server_url
              }
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {registering ? 'Registering...' : 'Register & Test Connection'}
            </button>
          </div>
        </div>
      )}

      {/* Servers list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Registered Servers ({filteredServers.length})
          </h2>
          <button
            onClick={fetchServers}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            🔄 Refresh
          </button>
        </div>

        {loading && (
          <div className="text-center py-12 text-gray-600">Loading servers...</div>
        )}

        {!loading && filteredServers.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600 mb-2">No MCP servers registered yet</p>
            <p className="text-sm text-gray-500">
              Click "Register Server" to add your first MCP server
            </p>
          </div>
        )}

        {!loading &&
          filteredServers.map((server) => (
            <MCPServerCard
              key={server.id}
              server={server}
              onDelete={handleDeleteServer}
              onToggleStatus={handleToggleStatus}
              onRefreshHealth={handleRefreshHealth}
            />
          ))}
      </div>
    </div>
  )
}
