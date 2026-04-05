/**
 * Features 167-168: Flow Export Module
 * Convert ReactFlow conversation graphs to Vapi assistant configuration and system prompts
 */

import type {
  ConversationFlow,
  FlowNode,
  FlowEdge,
  FlowExportResult,
  FlowValidationResult,
  SpeakNode,
  ListenNode,
  ConditionNode,
  ToolNode,
  TransferNode,
  EndNode,
} from './flow-types'

/**
 * Feature 167: Convert ReactFlow graph to Vapi assistant config JSON
 */
export function exportFlowToVapiConfig(flow: ConversationFlow): FlowExportResult {
  // Validate flow first
  const validation = validateFlow(flow)
  if (!validation.valid) {
    throw new Error(
      `Cannot export invalid flow: ${validation.errors.join(', ')}`
    )
  }

  // Find entry node (node with no incoming edges or marked as entry)
  const entryNode = findEntryNode(flow.nodes, flow.edges)
  if (!entryNode) {
    throw new Error('Flow must have an entry node (SpeakNode with no incoming edges)')
  }

  // Generate system prompt from flow graph
  const systemPrompt = generateSystemPrompt(flow)

  // Extract function tools from ToolNodes
  const tools = extractToolsFromFlow(flow)

  // Get first message (from entry SpeakNode)
  const firstMessage =
    entryNode.type === 'speak' ? entryNode.data.message : undefined

  // Build Vapi assistant config
  const assistantConfig = {
    name: flow.name,
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
      ],
    },
    voice: {
      provider: 'elevenlabs',
      voiceId: '21m00Tcm4TlvDq8ikWAM', // Default voice (Rachel)
    },
    firstMessage,
    ...(tools.length > 0 && { tools }),
  }

  return {
    assistant_config: assistantConfig,
    system_prompt: systemPrompt,
    flow_metadata: {
      flow_id: flow.id || 0,
      flow_name: flow.name,
      flow_version: flow.version,
      total_nodes: flow.nodes.length,
      entry_point: entryNode.id,
    },
  }
}

/**
 * Feature 168: Generate system prompt from flow nodes
 */
export function generateSystemPrompt(flow: ConversationFlow): string {
  const lines: string[] = []

  // Header
  lines.push(`# Conversation Flow: ${flow.name}`)
  if (flow.description) {
    lines.push(`## Description\n${flow.description}`)
  }

  lines.push('\n## Instructions')
  lines.push(
    'You are a voice AI agent following a structured conversation flow. Each step in the conversation is defined below. Follow the flow exactly as specified.'
  )

  lines.push('\n## Conversation Flow Steps\n')

  // Generate step-by-step instructions from nodes
  const entryNode = findEntryNode(flow.nodes, flow.edges)
  const visitedNodes = new Set<string>()

  function traverseFlow(nodeId: string, stepNumber: number): number {
    if (visitedNodes.has(nodeId)) {
      return stepNumber
    }
    visitedNodes.add(nodeId)

    const node = flow.nodes.find((n) => n.id === nodeId)
    if (!node) {
      return stepNumber
    }

    lines.push(`### Step ${stepNumber}: ${node.data.label}`)

    switch (node.type) {
      case 'speak':
        const speakNode = node as SpeakNode
        lines.push(`- **Action:** Say the following message:`)
        lines.push(`  > "${speakNode.data.message}"`)
        if (speakNode.data.emotion) {
          lines.push(`- **Tone:** ${speakNode.data.emotion}`)
        }
        break

      case 'listen':
        const listenNode = node as ListenNode
        lines.push(`- **Action:** Listen for user response`)
        lines.push(
          `- **Expected intents:** ${listenNode.data.expected_intents.join(', ')}`
        )
        if (listenNode.data.timeout_seconds) {
          lines.push(
            `- **Timeout:** ${listenNode.data.timeout_seconds} seconds`
          )
        }
        if (listenNode.data.fallback_message) {
          lines.push(
            `- **If not understood:** "${listenNode.data.fallback_message}"`
          )
        }
        break

      case 'condition':
        const conditionNode = node as ConditionNode
        lines.push(`- **Action:** Evaluate condition`)
        lines.push(`- **Condition:** ${conditionNode.data.condition}`)
        lines.push(
          `- **If true:** Go to ${conditionNode.data.branches.true_label || 'next true branch'}`
        )
        lines.push(
          `- **If false:** Go to ${conditionNode.data.branches.false_label || 'next false branch'}`
        )
        break

      case 'tool':
        const toolNode = node as ToolNode
        lines.push(`- **Action:** Call tool "${toolNode.data.tool_name}"`)
        if (Object.keys(toolNode.data.parameters).length > 0) {
          lines.push(`- **Parameters:**`)
          for (const [key, value] of Object.entries(
            toolNode.data.parameters
          )) {
            lines.push(`  - ${key}: ${JSON.stringify(value)}`)
          }
        }
        if (toolNode.data.store_result_as) {
          lines.push(
            `- **Store result as:** {{${toolNode.data.store_result_as}}}`
          )
        }
        if (toolNode.data.on_success_message) {
          lines.push(
            `- **On success:** "${toolNode.data.on_success_message}"`
          )
        }
        if (toolNode.data.on_error_message) {
          lines.push(`- **On error:** "${toolNode.data.on_error_message}"`)
        }
        break

      case 'transfer':
        const transferNode = node as TransferNode
        lines.push(
          `- **Action:** Transfer call to ${transferNode.data.transfer_type}`
        )
        lines.push(`- **Destination:** ${transferNode.data.destination}`)
        if (transferNode.data.transfer_message) {
          lines.push(
            `- **Message before transfer:** "${transferNode.data.transfer_message}"`
          )
        }
        break

      case 'end':
        const endNode = node as EndNode
        lines.push(
          `- **Action:** End conversation (${endNode.data.end_reason})`
        )
        if (endNode.data.final_message) {
          lines.push(`- **Final message:** "${endNode.data.final_message}"`)
        }
        if (endNode.data.record_outcome) {
          lines.push(
            `- **Record outcome:** ${endNode.data.record_outcome}`
          )
        }
        return stepNumber + 1 // No further traversal after end
    }

    lines.push('') // Blank line between steps

    // Find outgoing edges and traverse next nodes
    const outgoingEdges = flow.edges.filter((e) => e.source === nodeId)
    let nextStep = stepNumber + 1

    for (const edge of outgoingEdges) {
      nextStep = traverseFlow(edge.target, nextStep)
    }

    return nextStep
  }

  if (entryNode) {
    traverseFlow(entryNode.id, 1)
  }

  // Add variable context section
  lines.push('\n## Available Context Variables')
  lines.push('- `{{caller_name}}` - Caller\'s name from caller memory')
  lines.push('- `{{caller_phone}}` - Caller\'s phone number')
  lines.push('- `{{call_count}}` - Number of previous calls from this caller')
  lines.push('- `{{last_call_summary}}` - Summary of last conversation')
  lines.push(
    '- Custom variables from tool results (e.g., `{{calendar_slots}}`)'
  )

  lines.push('\n## Important Rules')
  lines.push('- Follow the flow steps exactly as defined above')
  lines.push('- Do not skip steps or deviate from the intended path')
  lines.push('- Use natural, conversational language when speaking')
  lines.push('- Be empathetic and patient with the caller')
  lines.push('- If caller goes off-script, gently guide them back to the flow')

  return lines.join('\n')
}

/**
 * Extract Vapi function tools from ToolNodes in the flow
 */
function extractToolsFromFlow(
  flow: ConversationFlow
): Array<{
  type: string
  function: {
    name: string
    description: string
    parameters: Record<string, any>
  }
  server?: { url: string }
}> {
  const tools: Array<any> = []
  const seenTools = new Set<string>()

  for (const node of flow.nodes) {
    if (node.type === 'tool') {
      const toolNode = node as ToolNode

      // Skip duplicates
      if (seenTools.has(toolNode.data.tool_name)) {
        continue
      }
      seenTools.add(toolNode.data.tool_name)

      if (toolNode.data.tool_type === 'vapi_function') {
        // Standard Vapi function tool
        tools.push({
          type: 'function',
          function: {
            name: toolNode.data.tool_name,
            description: toolNode.data.label,
            parameters: {
              type: 'object',
              properties: toolNode.data.parameters || {},
            },
          },
          server: {
            url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/tools/${toolNode.data.tool_name}`,
          },
        })
      } else if (toolNode.data.tool_type === 'mcp_tool') {
        // MCP bridge tool
        tools.push({
          type: 'function',
          function: {
            name: 'callMCPTool',
            description: `Call MCP tool: ${toolNode.data.tool_name}`,
            parameters: {
              type: 'object',
              properties: {
                server: { type: 'string' },
                tool: { type: 'string' },
                params: { type: 'object' },
              },
              required: ['server', 'tool', 'params'],
            },
          },
          server: {
            url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/tools/mcp-bridge`,
          },
        })
      }
    }
  }

  return tools
}

/**
 * Find the entry node (first SpeakNode with no incoming edges)
 */
function findEntryNode(
  nodes: FlowNode[],
  edges: FlowEdge[]
): FlowNode | null {
  const nodesWithIncomingEdges = new Set(edges.map((e) => e.target))

  // Find first SpeakNode with no incoming edges
  for (const node of nodes) {
    if (node.type === 'speak' && !nodesWithIncomingEdges.has(node.id)) {
      return node
    }
  }

  // Fallback: any node with no incoming edges
  for (const node of nodes) {
    if (!nodesWithIncomingEdges.has(node.id)) {
      return node
    }
  }

  return null
}

/**
 * Validate conversation flow structure
 */
export function validateFlow(flow: ConversationFlow): FlowValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check for nodes
  if (flow.nodes.length === 0) {
    errors.push('Flow must have at least one node')
    return { valid: false, errors, warnings }
  }

  // Check for entry node
  const entryNode = findEntryNode(flow.nodes, flow.edges)
  if (!entryNode) {
    errors.push('Flow must have an entry node (a node with no incoming edges)')
  }

  // Check for orphaned nodes (no path to/from them)
  const connectedNodes = new Set<string>()
  for (const edge of flow.edges) {
    connectedNodes.add(edge.source)
    connectedNodes.add(edge.target)
  }

  for (const node of flow.nodes) {
    if (flow.nodes.length > 1 && !connectedNodes.has(node.id)) {
      warnings.push(`Node "${node.data.label}" (${node.id}) is orphaned (not connected)`)
    }
  }

  // Check for end nodes
  const hasEndNode = flow.nodes.some((n) => n.type === 'end')
  if (!hasEndNode) {
    warnings.push(
      'Flow should have at least one EndNode for proper conversation termination'
    )
  }

  // Validate individual nodes
  for (const node of flow.nodes) {
    switch (node.type) {
      case 'speak':
        const speakNode = node as SpeakNode
        if (!speakNode.data.message || speakNode.data.message.trim() === '') {
          errors.push(
            `SpeakNode "${speakNode.data.label}" has no message`
          )
        }
        break

      case 'listen':
        const listenNode = node as ListenNode
        if (
          !listenNode.data.expected_intents ||
          listenNode.data.expected_intents.length === 0
        ) {
          warnings.push(
            `ListenNode "${listenNode.data.label}" has no expected intents`
          )
        }
        break

      case 'tool':
        const toolNode = node as ToolNode
        if (!toolNode.data.tool_name) {
          errors.push(`ToolNode "${toolNode.data.label}" has no tool_name`)
        }
        break

      case 'transfer':
        const transferNode = node as TransferNode
        if (!transferNode.data.destination) {
          errors.push(
            `TransferNode "${transferNode.data.label}" has no destination`
          )
        }
        break
    }
  }

  // Validate edges
  const nodeIds = new Set(flow.nodes.map((n) => n.id))
  for (const edge of flow.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} references non-existent source node ${edge.source}`)
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} references non-existent target node ${edge.target}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
