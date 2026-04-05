/**
 * Feature 188: FlowSimulator - Interactive Chat Interface
 * Step-by-step conversation testing UI for flows
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import type {
  ConversationFlow,
  FlowNode,
  SpeakNode,
  ListenNode,
  ConditionNode,
  ToolNode,
  TransferNode,
  EndNode,
} from '@/lib/flow-types'

interface FlowSimulatorProps {
  flow: ConversationFlow
  onClose: () => void
}

interface ChatMessage {
  id: string
  type: 'agent' | 'user' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    node_id?: string
    node_type?: string
    intent?: string
    tool_call?: {
      tool_name: string
      result: any
    }
  }
}

export default function FlowSimulator({ flow, onClose }: FlowSimulatorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [conversationContext, setConversationContext] = useState<Record<string, any>>({
    caller_name: 'Test User',
    caller_phone: '+15555555555',
    call_count: 1,
    last_call_summary: 'First call',
  })
  const [userInput, setUserInput] = useState('')
  const [conversationEnded, setConversationEnded] = useState(false)
  const [waitingForUser, setWaitingForUser] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when waiting for user
  useEffect(() => {
    if (waitingForUser && inputRef.current) {
      inputRef.current.focus()
    }
  }, [waitingForUser])

  // Start conversation on mount
  useEffect(() => {
    startConversation()
  }, [])

  function startConversation() {
    // Find entry node (no incoming edges)
    const entryNode = findEntryNode(flow.nodes, flow.edges)

    if (!entryNode) {
      addSystemMessage('Error: Flow has no entry node')
      setConversationEnded(true)
      return
    }

    addSystemMessage(`🎬 Starting conversation: ${flow.name}`)
    setCurrentNodeId(entryNode.id)
    processNode(entryNode.id)
  }

  function addSystemMessage(content: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random()}`,
        type: 'system',
        content,
        timestamp: new Date(),
      },
    ])
  }

  function addAgentMessage(content: string, nodeId: string, nodeType: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random()}`,
        type: 'agent',
        content,
        timestamp: new Date(),
        metadata: { node_id: nodeId, node_type: nodeType },
      },
    ])
  }

  function addUserMessage(content: string, intent?: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random()}`,
        type: 'user',
        content,
        timestamp: new Date(),
        metadata: intent ? { intent } : undefined,
      },
    ])
  }

  async function processNode(nodeId: string) {
    if (!nodeId || conversationEnded) return

    setIsProcessing(true)
    const currentNode = flow.nodes.find((n) => n.id === nodeId)

    if (!currentNode) {
      addSystemMessage(`❌ Error: Node ${nodeId} not found`)
      setConversationEnded(true)
      setIsProcessing(false)
      return
    }

    try {
      switch (currentNode.type) {
        case 'speak':
          await handleSpeakNode(currentNode as SpeakNode)
          break
        case 'listen':
          await handleListenNode(currentNode as ListenNode)
          break
        case 'condition':
          await handleConditionNode(currentNode as ConditionNode)
          break
        case 'tool':
          await handleToolNode(currentNode as ToolNode)
          break
        case 'transfer':
          await handleTransferNode(currentNode as TransferNode)
          break
        case 'end':
          await handleEndNode(currentNode as EndNode)
          break
      }
    } catch (error: any) {
      addSystemMessage(`❌ Error processing node: ${error.message}`)
      setConversationEnded(true)
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleSpeakNode(node: SpeakNode) {
    const message = interpolateVariables(node.data.message, conversationContext)
    addAgentMessage(message, node.id, 'speak')

    // Auto-advance to next node after brief delay
    await sleep(300)
    const nextNodeId = getNextNode(node.id, flow.edges)
    if (nextNodeId) {
      setCurrentNodeId(nextNodeId)
      processNode(nextNodeId)
    } else {
      addSystemMessage('⚠️ Warning: No next node from speak node')
      setConversationEnded(true)
    }
  }

  async function handleListenNode(node: ListenNode) {
    // Wait for user input
    setWaitingForUser(true)
    // Input handler will process when user submits
  }

  function handleUserSubmit() {
    if (!userInput.trim() || !currentNodeId) return

    const trimmedInput = userInput.trim()
    setUserInput('')
    setWaitingForUser(false)

    const currentNode = flow.nodes.find((n) => n.id === currentNodeId) as ListenNode

    // Extract intent
    const intent = extractIntent(
      trimmedInput,
      currentNode?.data?.expected_intents || []
    )

    addUserMessage(trimmedInput, intent)

    // Store intent in context
    setConversationContext((prev) => ({ ...prev, last_intent: intent }))

    // Move to next node
    const nextNodeId = getNextNode(currentNodeId, flow.edges)
    if (nextNodeId) {
      setCurrentNodeId(nextNodeId)
      processNode(nextNodeId)
    } else {
      addSystemMessage('⚠️ Warning: No next node from listen node')
      setConversationEnded(true)
    }
  }

  async function handleConditionNode(node: ConditionNode) {
    addSystemMessage(`🔀 Evaluating condition: ${node.data.condition}`)

    const result = evaluateCondition(node.data.condition, conversationContext)
    addSystemMessage(`   Result: ${result ? 'TRUE' : 'FALSE'}`)

    const nextNodeId = getConditionalNextNode(node.id, flow.edges, result)

    if (nextNodeId) {
      setCurrentNodeId(nextNodeId)
      await sleep(300)
      processNode(nextNodeId)
    } else {
      addSystemMessage('⚠️ Warning: No matching branch from condition node')
      setConversationEnded(true)
    }
  }

  async function handleToolNode(node: ToolNode) {
    addSystemMessage(`🔧 Calling tool: ${node.data.tool_name}`)

    // Simulate tool call
    const result = await simulateToolCall(
      node.data.tool_name,
      interpolateObjectVariables(node.data.parameters, conversationContext)
    )

    addSystemMessage(`   Result: ${JSON.stringify(result)}`)

    // Store result in context
    if (node.data.store_result_as) {
      setConversationContext((prev) => ({
        ...prev,
        [node.data.store_result_as!]: result,
      }))
    }

    // Show success/error message
    if (result.success && node.data.on_success_message) {
      const message = interpolateVariables(
        node.data.on_success_message,
        conversationContext
      )
      addAgentMessage(message, node.id, 'tool')
    } else if (!result.success && node.data.on_error_message) {
      const message = interpolateVariables(
        node.data.on_error_message,
        conversationContext
      )
      addAgentMessage(message, node.id, 'tool')
    }

    await sleep(500)
    const nextNodeId = getNextNode(node.id, flow.edges)
    if (nextNodeId) {
      setCurrentNodeId(nextNodeId)
      processNode(nextNodeId)
    } else {
      addSystemMessage('⚠️ Warning: No next node from tool node')
      setConversationEnded(true)
    }
  }

  async function handleTransferNode(node: TransferNode) {
    if (node.data.transfer_message) {
      const message = interpolateVariables(
        node.data.transfer_message,
        conversationContext
      )
      addAgentMessage(message, node.id, 'transfer')
    }

    await sleep(300)
    addSystemMessage(
      `📞 Transferring to ${node.data.destination} (${node.data.transfer_type})`
    )
    addSystemMessage('✅ Conversation ended: TRANSFER')
    setConversationEnded(true)
  }

  async function handleEndNode(node: EndNode) {
    if (node.data.final_message) {
      const message = interpolateVariables(
        node.data.final_message,
        conversationContext
      )
      addAgentMessage(message, node.id, 'end')
      await sleep(300)
    }

    const outcomeIcon =
      node.data.end_reason === 'success'
        ? '✅'
        : node.data.end_reason === 'failure'
        ? '❌'
        : '⏱️'

    addSystemMessage(
      `${outcomeIcon} Conversation ended: ${node.data.end_reason.toUpperCase()}`
    )
    setConversationEnded(true)
  }

  function handleKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleUserSubmit()
    }
  }

  function resetConversation() {
    setMessages([])
    setCurrentNodeId(null)
    setConversationContext({
      caller_name: 'Test User',
      caller_phone: '+15555555555',
      call_count: 1,
      last_call_summary: 'First call',
    })
    setUserInput('')
    setConversationEnded(false)
    setWaitingForUser(false)
    startConversation()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[700px] h-[600px] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">🎭 Flow Simulator</h2>
              <p className="text-sm opacity-90">{flow.name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-4 py-2 ${
                  msg.type === 'agent'
                    ? 'bg-white border border-gray-200 text-gray-800'
                    : msg.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 text-sm italic text-center w-full'
                }`}
              >
                {msg.type !== 'system' && (
                  <div className="text-xs opacity-70 mb-1">
                    {msg.type === 'agent' ? '🤖 Agent' : '👤 You'}
                  </div>
                )}
                <div>{msg.content}</div>
                {msg.metadata?.intent && (
                  <div className="text-xs mt-1 opacity-70">
                    Intent: {msg.metadata.intent}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="text-center text-gray-500 text-sm">
              <span className="inline-block animate-pulse">Processing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t bg-white p-4">
          {conversationEnded ? (
            <div className="flex gap-2">
              <button
                onClick={resetConversation}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                🔄 Restart Conversation
              </button>
              <button
                onClick={onClose}
                className="px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!waitingForUser || isProcessing}
                placeholder={
                  waitingForUser
                    ? 'Type your response...'
                    : 'Waiting for agent...'
                }
                className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleUserSubmit}
                disabled={!waitingForUser || !userInput.trim() || isProcessing}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                Send
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper functions

function findEntryNode(nodes: FlowNode[], edges: any[]): FlowNode | null {
  const nodesWithIncomingEdges = new Set(edges.map((e) => e.target))
  return nodes.find((n) => !nodesWithIncomingEdges.has(n.id)) || null
}

function getNextNode(currentNodeId: string, edges: any[]): string | null {
  const outgoingEdge = edges.find((e) => e.source === currentNodeId)
  return outgoingEdge ? outgoingEdge.target : null
}

function getConditionalNextNode(
  currentNodeId: string,
  edges: any[],
  conditionResult: boolean
): string | null {
  const outgoingEdges = edges.filter((e) => e.source === currentNodeId)

  const trueEdge = outgoingEdges.find(
    (e) => e.label?.toLowerCase() === 'true' || e.sourceHandle === 'true'
  )
  const falseEdge = outgoingEdges.find(
    (e) => e.label?.toLowerCase() === 'false' || e.sourceHandle === 'false'
  )

  if (conditionResult && trueEdge) {
    return trueEdge.target
  } else if (!conditionResult && falseEdge) {
    return falseEdge.target
  }

  return outgoingEdges[0]?.target || null
}

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

function extractIntent(userInput: string, expectedIntents: string[]): string {
  const input = userInput.toLowerCase()

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

function evaluateCondition(
  condition: string,
  context: Record<string, any>
): boolean {
  try {
    let expr = condition
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
      const replacement =
        typeof value === 'string' ? `"${value}"` : String(value)
      expr = expr.replace(regex, replacement)
    }

    const result = Function(`"use strict"; return (${expr})`)()
    return Boolean(result)
  } catch (error) {
    console.error('Error evaluating condition:', condition, error)
    return false
  }
}

async function simulateToolCall(
  toolName: string,
  params: Record<string, any>
): Promise<any> {
  // Mock tool responses
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

  // Simulate network delay
  await sleep(500)

  return (
    mockResponses[toolName] || {
      success: true,
      message: `Tool ${toolName} executed successfully`,
    }
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
