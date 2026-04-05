/**
 * Feature 170: Flow Node Type Definitions
 * TypeScript types for ReactFlow-based conversation state machine nodes
 */

// Base node type (common properties for all node types)
export interface BaseFlowNode {
  id: string
  type: 'speak' | 'listen' | 'condition' | 'tool' | 'transfer' | 'end'
  position: { x: number; y: number }
  data: Record<string, any>
}

/**
 * SpeakNode: Agent speaks a message to the caller
 */
export interface SpeakNode extends BaseFlowNode {
  type: 'speak'
  data: {
    label: string
    message: string // Supports template variables like {{caller_name}}
    voice_id?: string // Override default voice
    emotion?: 'neutral' | 'happy' | 'sad' | 'excited' | 'empathetic'
  }
}

/**
 * ListenNode: Agent listens for specific intents or entities
 */
export interface ListenNode extends BaseFlowNode {
  type: 'listen'
  data: {
    label: string
    expected_intents: string[] // e.g., ['affirmative', 'negative', 'book_appointment']
    timeout_seconds?: number // How long to wait before timeout edge
    fallback_message?: string // Message if intent not recognized
  }
}

/**
 * ConditionNode: Branch based on a condition
 */
export interface ConditionNode extends BaseFlowNode {
  type: 'condition'
  data: {
    label: string
    condition_type: 'intent' | 'entity' | 'sentiment' | 'custom_variable'
    condition: string // e.g., "intent === 'affirmative'" or "sentiment > 0.5"
    branches: {
      true_label?: string
      false_label?: string
    }
  }
}

/**
 * ToolNode: Call a function tool (Vapi function or MCP tool)
 */
export interface ToolNode extends BaseFlowNode {
  type: 'tool'
  data: {
    label: string
    tool_type: 'vapi_function' | 'mcp_tool'
    tool_name: string // e.g., 'checkCalendar', 'searchKnowledgeBase'
    parameters: Record<string, any> // Static parameters (can include template vars)
    store_result_as?: string // Variable name to store result in context
    on_success_message?: string
    on_error_message?: string
  }
}

/**
 * TransferNode: Transfer call to a human or external number
 */
export interface TransferNode extends BaseFlowNode {
  type: 'transfer'
  data: {
    label: string
    transfer_type: 'human' | 'external_number' | 'sip_uri'
    destination: string // Phone number, SIP URI, or queue name
    transfer_message?: string // Message before transfer
    on_transfer_failed_message?: string
  }
}

/**
 * EndNode: End the conversation
 */
export interface EndNode extends BaseFlowNode {
  type: 'end'
  data: {
    label: string
    end_reason: 'success' | 'failure' | 'hangup' | 'timeout'
    final_message?: string // Optional farewell message
    record_outcome?: string // Outcome to log in call metadata
  }
}

/**
 * Union type of all flow nodes
 */
export type FlowNode =
  | SpeakNode
  | ListenNode
  | ConditionNode
  | ToolNode
  | TransferNode
  | EndNode

/**
 * ReactFlow edge type
 */
export interface FlowEdge {
  id: string
  source: string // Node ID
  target: string // Node ID
  sourceHandle?: string // Handle ID (for branching nodes)
  targetHandle?: string
  label?: string // Edge label (e.g., "Yes", "No", "Timeout")
  type?: 'default' | 'smoothstep' | 'step'
  animated?: boolean
}

/**
 * Complete flow graph
 */
export interface ConversationFlow {
  id?: number
  tenant_id: string
  name: string
  description?: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  version: number
  vapi_assistant_id?: string
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

/**
 * Flow validation result
 */
export interface FlowValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Flow export result (Vapi assistant config + system prompt)
 */
export interface FlowExportResult {
  assistant_config: {
    name: string
    model: {
      provider: string
      model: string
      messages: Array<{ role: string; content: string }>
    }
    voice: {
      provider: string
      voiceId: string
    }
    firstMessage?: string
    tools?: Array<{
      type: string
      function: {
        name: string
        description: string
        parameters: Record<string, any>
      }
      server?: {
        url: string
      }
    }>
  }
  system_prompt: string
  flow_metadata: {
    flow_id: number
    flow_name: string
    flow_version: number
    total_nodes: number
    entry_point: string
  }
}

/**
 * Simulation step result
 */
export interface SimulationStep {
  step_number: number
  current_node_id: string
  current_node_type: string
  agent_message?: string
  user_input?: string
  extracted_intent?: string
  condition_result?: boolean
  tool_call?: {
    tool_name: string
    parameters: Record<string, any>
    result: any
  }
  next_node_id?: string
  conversation_ended: boolean
  end_reason?: string
}

/**
 * Full simulation result
 */
export interface FlowSimulationResult {
  flow_name: string
  start_time: string
  end_time: string
  total_steps: number
  steps: SimulationStep[]
  final_outcome: 'success' | 'failure' | 'timeout' | 'error'
  conversation_context: Record<string, any>
}
