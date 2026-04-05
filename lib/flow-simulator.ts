/**
 * Feature 169: Flow Simulator
 * Text-based simulation of conversation flows for testing before deployment
 */

import type {
  ConversationFlow,
  FlowNode,
  FlowEdge,
  FlowSimulationResult,
  SimulationStep,
  SpeakNode,
  ListenNode,
  ConditionNode,
  ToolNode,
  TransferNode,
  EndNode,
} from './flow-types'

/**
 * Simulate a conversation flow with mock user inputs
 */
export async function simulateConversationFlow(
  flow: ConversationFlow,
  userInputs: string[], // Array of simulated user responses
  context: Record<string, any> = {} // Initial conversation context (caller_name, etc.)
): Promise<FlowSimulationResult> {
  const startTime = new Date().toISOString()
  const steps: SimulationStep[] = []
  let currentNodeId: string | null = null
  let conversationEnded = false
  let finalOutcome: 'success' | 'failure' | 'timeout' | 'error' = 'success'
  let userInputIndex = 0

  // Enrich context with default variables
  const conversationContext: Record<string, any> = {
    caller_name: context.caller_name || 'Test Caller',
    caller_phone: context.caller_phone || '+15555555555',
    call_count: context.call_count || 1,
    last_call_summary: context.last_call_summary || 'First call',
    ...context,
  }

  // Find entry node
  const entryNode = findEntryNode(flow.nodes, flow.edges)
  if (!entryNode) {
    throw new Error('Flow has no entry node')
  }

  currentNodeId = entryNode.id
  let stepNumber = 1

  // Traverse flow
  while (currentNodeId && !conversationEnded && stepNumber <= 100) {
    const currentNode = flow.nodes.find((n) => n.id === currentNodeId)
    if (!currentNode) {
      finalOutcome = 'error'
      conversationEnded = true
      break
    }

    const step: SimulationStep = {
      step_number: stepNumber,
      current_node_id: currentNodeId,
      current_node_type: currentNode.type,
      conversation_ended: false,
    }

    try {
      // Process node based on type
      switch (currentNode.type) {
        case 'speak':
          const speakNode = currentNode as SpeakNode
          step.agent_message = interpolateVariables(
            speakNode.data.message,
            conversationContext
          )
          // Move to next node automatically
          currentNodeId = getNextNode(currentNodeId, flow.edges)
          break

        case 'listen':
          const listenNode = currentNode as ListenNode
          // Get next user input from mock inputs
          if (userInputIndex < userInputs.length) {
            step.user_input = userInputs[userInputIndex++]
            // Simulate intent extraction (simplified)
            step.extracted_intent = extractIntent(
              step.user_input,
              listenNode.data.expected_intents
            )
            // Move to next node
            currentNodeId = getNextNode(currentNodeId, flow.edges)
          } else {
            // No more user inputs - timeout
            finalOutcome = 'timeout'
            conversationEnded = true
            step.conversation_ended = true
            step.end_reason = 'timeout'
          }
          break

        case 'condition':
          const conditionNode = currentNode as ConditionNode
          // Evaluate condition
          step.condition_result = evaluateCondition(
            conditionNode.data.condition,
            conversationContext
          )
          // Choose next node based on condition result
          currentNodeId = getConditionalNextNode(
            currentNodeId,
            flow.edges,
            step.condition_result
          )
          break

        case 'tool':
          const toolNode = currentNode as ToolNode
          // Simulate tool call
          const toolResult = await simulateToolCall(
            toolNode.data.tool_name,
            interpolateObjectVariables(
              toolNode.data.parameters,
              conversationContext
            )
          )
          step.tool_call = {
            tool_name: toolNode.data.tool_name,
            parameters: toolNode.data.parameters,
            result: toolResult,
          }
          // Store result in context if specified
          if (toolNode.data.store_result_as) {
            conversationContext[toolNode.data.store_result_as] = toolResult
          }
          // Set agent message based on success/failure
          if (toolResult.success) {
            if (toolNode.data.on_success_message) {
              step.agent_message = interpolateVariables(
                toolNode.data.on_success_message,
                conversationContext
              )
            }
          } else {
            if (toolNode.data.on_error_message) {
              step.agent_message = interpolateVariables(
                toolNode.data.on_error_message,
                conversationContext
              )
            }
          }
          currentNodeId = getNextNode(currentNodeId, flow.edges)
          break

        case 'transfer':
          const transferNode = currentNode as TransferNode
          if (transferNode.data.transfer_message) {
            step.agent_message = interpolateVariables(
              transferNode.data.transfer_message,
              conversationContext
            )
          }
          step.agent_message =
            (step.agent_message || '') +
            ` [TRANSFER to ${transferNode.data.destination}]`
          conversationEnded = true
          step.conversation_ended = true
          step.end_reason = 'transfer'
          finalOutcome = 'success'
          break

        case 'end':
          const endNode = currentNode as EndNode
          if (endNode.data.final_message) {
            step.agent_message = interpolateVariables(
              endNode.data.final_message,
              conversationContext
            )
          }
          conversationEnded = true
          step.conversation_ended = true
          step.end_reason = endNode.data.end_reason
          finalOutcome = endNode.data.end_reason === 'success' ? 'success' : 'failure'
          break
      }

      step.next_node_id = currentNodeId || undefined
      steps.push(step)
      stepNumber++
    } catch (error: any) {
      console.error('Simulation error at step', stepNumber, error)
      finalOutcome = 'error'
      conversationEnded = true
      step.conversation_ended = true
      step.end_reason = 'error'
      steps.push(step)
      break
    }
  }

  // Prevent infinite loops
  if (stepNumber > 100) {
    finalOutcome = 'error'
  }

  return {
    flow_name: flow.name,
    start_time: startTime,
    end_time: new Date().toISOString(),
    total_steps: steps.length,
    steps,
    final_outcome: finalOutcome,
    conversation_context: conversationContext,
  }
}

/**
 * Helper: Find entry node
 */
function findEntryNode(
  nodes: FlowNode[],
  edges: FlowEdge[]
): FlowNode | null {
  const nodesWithIncomingEdges = new Set(edges.map((e) => e.target))
  return nodes.find((n) => !nodesWithIncomingEdges.has(n.id)) || null
}

/**
 * Helper: Get next node from edges
 */
function getNextNode(currentNodeId: string, edges: FlowEdge[]): string | null {
  const outgoingEdge = edges.find((e) => e.source === currentNodeId)
  return outgoingEdge ? outgoingEdge.target : null
}

/**
 * Helper: Get next node based on condition result (true/false)
 */
function getConditionalNextNode(
  currentNodeId: string,
  edges: FlowEdge[],
  conditionResult: boolean
): string | null {
  const outgoingEdges = edges.filter((e) => e.source === currentNodeId)

  // Look for edges labeled "true" or "false" (or sourceHandle)
  const trueEdge = outgoingEdges.find(
    (e) =>
      e.label?.toLowerCase() === 'true' || e.sourceHandle === 'true'
  )
  const falseEdge = outgoingEdges.find(
    (e) =>
      e.label?.toLowerCase() === 'false' || e.sourceHandle === 'false'
  )

  if (conditionResult && trueEdge) {
    return trueEdge.target
  } else if (!conditionResult && falseEdge) {
    return falseEdge.target
  }

  // Fallback: just take first edge
  return outgoingEdges[0]?.target || null
}

/**
 * Helper: Interpolate template variables in string (e.g., "Hello {{caller_name}}")
 */
function interpolateVariables(
  template: string,
  context: Record<string, any>
): string {
  let result = template
  for (const [key, value] of Object.entries(context)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    result = result.replace(regex, String(value))
  }
  return result
}

/**
 * Helper: Interpolate template variables in object
 */
function interpolateObjectVariables(
  obj: Record<string, any>,
  context: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = interpolateVariables(value, context)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Helper: Extract intent from user input (simple keyword matching simulation)
 */
function extractIntent(
  userInput: string,
  expectedIntents: string[]
): string {
  const input = userInput.toLowerCase()

  // Simple heuristic intent matching
  const intentKeywords: Record<string, string[]> = {
    affirmative: ['yes', 'yeah', 'sure', 'okay', 'yep', 'correct', 'right'],
    negative: ['no', 'nope', 'not', 'never', 'nah'],
    book_appointment: ['book', 'schedule', 'appointment', 'meeting', 'reserve'],
    cancel_appointment: ['cancel', 'remove', 'delete', 'reschedule'],
    pricing: ['price', 'cost', 'how much', 'pricing', 'pay', 'payment'],
    support: ['help', 'support', 'issue', 'problem', 'question'],
  }

  for (const intent of expectedIntents) {
    const keywords = intentKeywords[intent] || [intent]
    if (keywords.some((kw) => input.includes(kw))) {
      return intent
    }
  }

  return 'unknown'
}

/**
 * Helper: Evaluate condition expression (simplified)
 */
function evaluateCondition(
  condition: string,
  context: Record<string, any>
): boolean {
  try {
    // Replace context variables in condition
    let expr = condition
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
      const replacement =
        typeof value === 'string' ? `"${value}"` : String(value)
      expr = expr.replace(regex, replacement)
    }

    // Evaluate expression (UNSAFE - for simulation only)
    // In production, use a safe expression evaluator
    const result = Function(`"use strict"; return (${expr})`)()
    return Boolean(result)
  } catch (error) {
    console.error('Error evaluating condition:', condition, error)
    return false
  }
}

/**
 * Helper: Simulate tool call (returns mock data)
 */
async function simulateToolCall(
  toolName: string,
  params: Record<string, any>
): Promise<any> {
  // Mock tool responses for common tools
  const mockResponses: Record<string, any> = {
    checkCalendar: {
      success: true,
      available_slots: [
        '2026-04-05 10:00 AM',
        '2026-04-05 2:00 PM',
        '2026-04-06 9:00 AM',
      ],
    },
    searchKnowledgeBase: {
      success: true,
      result: {
        answer:
          'Our pricing starts at $99/month for the basic plan and $299/month for the pro plan.',
        confidence: 0.92,
      },
    },
    bookAppointment: {
      success: true,
      confirmation_id: 'CONF-12345',
      appointment_time: params.time || '2026-04-05 10:00 AM',
    },
    sendSMS: {
      success: true,
      message_id: 'SMS-67890',
    },
    getCallerMemory: {
      success: true,
      caller_name: 'John Doe',
      call_count: 3,
      last_call_summary: 'Asked about pricing, interested in pro plan',
      relationship_score: 75,
    },
  }

  // Return mock response or default success
  return (
    mockResponses[toolName] || {
      success: true,
      message: `Tool ${toolName} executed successfully`,
    }
  )
}

/**
 * Format simulation result as human-readable text
 */
export function formatSimulationAsText(
  simulation: FlowSimulationResult
): string {
  const lines: string[] = []

  lines.push(`=== Conversation Simulation: ${simulation.flow_name} ===`)
  lines.push(`Start: ${simulation.start_time}`)
  lines.push(`End: ${simulation.end_time}`)
  lines.push(`Total Steps: ${simulation.total_steps}`)
  lines.push(`Final Outcome: ${simulation.final_outcome.toUpperCase()}`)
  lines.push('')

  for (const step of simulation.steps) {
    lines.push(`--- Step ${step.step_number} (${step.current_node_type}) ---`)

    if (step.agent_message) {
      lines.push(`🤖 Agent: ${step.agent_message}`)
    }

    if (step.user_input) {
      lines.push(`👤 User: ${step.user_input}`)
      if (step.extracted_intent) {
        lines.push(`   [Intent: ${step.extracted_intent}]`)
      }
    }

    if (step.condition_result !== undefined) {
      lines.push(`   [Condition Result: ${step.condition_result}]`)
    }

    if (step.tool_call) {
      lines.push(
        `   [Tool Call: ${step.tool_call.tool_name}(${JSON.stringify(step.tool_call.parameters)})]`
      )
      lines.push(`   [Result: ${JSON.stringify(step.tool_call.result)}]`)
    }

    if (step.conversation_ended) {
      lines.push(`   [CONVERSATION ENDED: ${step.end_reason}]`)
    }

    lines.push('')
  }

  lines.push('=== Context Variables ===')
  for (const [key, value] of Object.entries(
    simulation.conversation_context
  )) {
    lines.push(`${key}: ${JSON.stringify(value)}`)
  }

  return lines.join('\n')
}
