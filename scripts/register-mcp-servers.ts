#!/usr/bin/env ts-node
/**
 * Features 157-158: Pre-register Supabase and Calendar MCP servers
 *
 * This script seeds the mcp_registry table with default MCP servers:
 * - Supabase MCP: execute_sql, list_tables, etc.
 * - Calendar MCP (agent-comms): list_events, create_event, etc.
 *
 * Usage:
 *   ts-node scripts/register-mcp-servers.ts
 *   OR
 *   npm run register-mcp-servers
 */

import { supabaseAdmin } from '../lib/supabase'

const DEFAULT_TENANT_ID = 'default'

interface MCPServerConfig {
  tenant_id: string
  server_name: string
  server_url: string
  auth_type: string
  auth_config: Record<string, any>
  enabled_tools: string[]
  status: string
  description?: string
}

const MCP_SERVERS: MCPServerConfig[] = [
  // Feature 157: Supabase MCP Server
  {
    tenant_id: DEFAULT_TENANT_ID,
    server_name: 'supabase',
    server_url: process.env.SUPABASE_MCP_SERVER_URL || 'http://localhost:3100/mcp',
    auth_type: 'api_key',
    auth_config: {
      api_key: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      project_ref: process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] || 'ivhfuhxorppptyuofbgq',
    },
    enabled_tools: [
      'execute_sql',
      'list_tables',
      'get_table_schema',
      'apply_migration',
      'list_migrations',
      'create_branch',
      'list_branches',
    ],
    status: 'active',
    description: 'Supabase database MCP server - execute SQL queries, manage tables, and run migrations',
  },

  // Feature 158: Calendar MCP Server (Google Calendar via agent-comms)
  {
    tenant_id: DEFAULT_TENANT_ID,
    server_name: 'calendar',
    server_url: process.env.CALENDAR_MCP_SERVER_URL || 'http://localhost:3200/mcp',
    auth_type: 'oauth',
    auth_config: {
      oauth_type: 'google',
      scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
      // Credentials will be set via OAuth flow in production
    },
    enabled_tools: [
      'list_events',
      'get_event',
      'create_event',
      'update_event',
      'delete_event',
      'find_free_slots',
      'get_calendars',
    ],
    status: 'active',
    description: 'Google Calendar MCP server - manage events, check availability, and book appointments',
  },

  // Optional: Gmail MCP Server (for sending emails during calls)
  {
    tenant_id: DEFAULT_TENANT_ID,
    server_name: 'gmail',
    server_url: process.env.GMAIL_MCP_SERVER_URL || 'http://localhost:3200/mcp',
    auth_type: 'oauth',
    auth_config: {
      oauth_type: 'google',
      scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
    },
    enabled_tools: [
      'send_email',
      'search_emails',
      'get_email',
      'list_labels',
    ],
    status: 'active',
    description: 'Gmail MCP server - send emails and search inbox',
  },
]

async function registerMCPServers() {
  console.log('[MCP Registry] Starting server registration...\n')

  for (const serverConfig of MCP_SERVERS) {
    console.log(`[MCP Registry] Registering ${serverConfig.server_name}...`)

    // Check if server already exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('mcp_registry')
      .select('id, server_name, status')
      .eq('tenant_id', serverConfig.tenant_id)
      .eq('server_name', serverConfig.server_name)
      .single()

    if (existing) {
      console.log(`  → Already registered (ID: ${existing.id}, Status: ${existing.status})`)
      console.log(`  → Updating configuration...`)

      // Update existing registration
      const { error: updateError } = await supabaseAdmin
        .from('mcp_registry')
        .update({
          server_url: serverConfig.server_url,
          auth_type: serverConfig.auth_type,
          auth_config: serverConfig.auth_config,
          enabled_tools: serverConfig.enabled_tools,
          status: serverConfig.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error(`  ✗ Failed to update: ${updateError.message}`)
      } else {
        console.log(`  ✓ Updated successfully`)
      }
    } else {
      // Insert new registration
      const { data, error: insertError } = await supabaseAdmin
        .from('mcp_registry')
        .insert({
          tenant_id: serverConfig.tenant_id,
          server_name: serverConfig.server_name,
          server_url: serverConfig.server_url,
          auth_type: serverConfig.auth_type,
          auth_config: serverConfig.auth_config,
          enabled_tools: serverConfig.enabled_tools,
          status: serverConfig.status,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error(`  ✗ Failed to register: ${insertError.message}`)
      } else {
        console.log(`  ✓ Registered successfully (ID: ${data.id})`)
      }
    }

    console.log(`  → URL: ${serverConfig.server_url}`)
    console.log(`  → Tools: ${serverConfig.enabled_tools.join(', ')}`)
    console.log(`  → Description: ${serverConfig.description}\n`)
  }

  // Summary
  const { data: allServers, error: listError } = await supabaseAdmin
    .from('mcp_registry')
    .select('server_name, status, enabled_tools')
    .eq('tenant_id', DEFAULT_TENANT_ID)
    .order('server_name')

  if (listError) {
    console.error('[MCP Registry] Error fetching summary:', listError.message)
  } else {
    console.log('[MCP Registry] Summary:')
    console.log('─'.repeat(60))
    allServers?.forEach((server: any) => {
      const toolCount = server.enabled_tools?.length || 0
      console.log(`  ${server.server_name.padEnd(15)} [${server.status.padEnd(8)}] ${toolCount} tools`)
    })
    console.log('─'.repeat(60))
    console.log(`  Total: ${allServers?.length || 0} servers registered\n`)
  }

  console.log('[MCP Registry] Registration complete!')
}

// Run if called directly
if (require.main === module) {
  registerMCPServers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[MCP Registry] Fatal error:', error)
      process.exit(1)
    })
}

export { registerMCPServers }
