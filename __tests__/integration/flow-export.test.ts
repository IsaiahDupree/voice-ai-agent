/**
 * Feature 189: Integration Test - Flow Export
 * Validates that conversation flows export to valid Vapi assistant configs
 */

import { exportFlowToVapiConfig, validateFlow } from '@/lib/flow-export'
import type { ConversationFlow } from '@/lib/flow-types'

describe('Flow Export Integration Tests', () => {
  test('should export simple appointment booking flow to valid Vapi config', () => {
    const flow: ConversationFlow = {
      id: 1,
      tenant_id: 'test',
      name: 'Appointment Booking Flow',
      description: 'Simple flow for booking appointments',
      version: 1,
      nodes: [
        {
          id: 'start',
          type: 'speak',
          position: { x: 0, y: 0 },
          data: {
            label: 'Greeting',
            message: 'Hello {{caller_name}}, would you like to book an appointment?',
          },
        },
        {
          id: 'listen1',
          type: 'listen',
          position: { x: 0, y: 100 },
          data: {
            label: 'Listen for response',
            expected_intents: ['affirmative', 'negative'],
            timeout_seconds: 10,
          },
        },
        {
          id: 'check-calendar',
          type: 'tool',
          position: { x: 0, y: 200 },
          data: {
            label: 'Check calendar',
            tool_type: 'vapi_function',
            tool_name: 'checkCalendar',
            parameters: {},
            store_result_as: 'available_slots',
          },
        },
        {
          id: 'end-success',
          type: 'end',
          position: { x: 0, y: 300 },
          data: {
            label: 'Success',
            end_reason: 'success',
            final_message: 'Great! Your appointment is booked.',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'listen1' },
        { id: 'e2', source: 'listen1', target: 'check-calendar' },
        { id: 'e3', source: 'check-calendar', target: 'end-success' },
      ],
    }

    const result = exportFlowToVapiConfig(flow)

    // Validate structure
    expect(result).toHaveProperty('assistant_config')
    expect(result).toHaveProperty('system_prompt')
    expect(result).toHaveProperty('flow_metadata')

    // Validate assistant config
    const config = result.assistant_config
    expect(config.name).toBe('Appointment Booking Flow')
    expect(config.model.provider).toBe('openai')
    expect(config.model.model).toBe('gpt-4o')
    expect(config.model.messages).toHaveLength(1)
    expect(config.model.messages[0].role).toBe('system')
    expect(config.voice.provider).toBe('elevenlabs')
    expect(config.firstMessage).toContain('Hello')

    // Validate tools extracted
    expect(config.tools).toBeDefined()
    expect(config.tools!.length).toBeGreaterThan(0)
    expect(config.tools![0].function.name).toBe('checkCalendar')

    // Validate system prompt
    expect(result.system_prompt).toContain('Conversation Flow: Appointment Booking Flow')
    expect(result.system_prompt).toContain('Step 1')
    expect(result.system_prompt).toContain('{{caller_name}}')

    // Validate metadata
    expect(result.flow_metadata.flow_name).toBe('Appointment Booking Flow')
    expect(result.flow_metadata.total_nodes).toBe(4)
    expect(result.flow_metadata.entry_point).toBe('start')
  })

  test('should export flow with condition branching', () => {
    const flow: ConversationFlow = {
      tenant_id: 'test',
      name: 'Conditional Flow',
      version: 1,
      nodes: [
        {
          id: 'start',
          type: 'speak',
          position: { x: 0, y: 0 },
          data: { label: 'Greeting', message: 'Hello!' },
        },
        {
          id: 'condition1',
          type: 'condition',
          position: { x: 0, y: 100 },
          data: {
            label: 'Check intent',
            condition_type: 'intent',
            condition: 'intent === "affirmative"',
            branches: { true_label: 'Yes path', false_label: 'No path' },
          },
        },
        {
          id: 'end-yes',
          type: 'end',
          position: { x: -100, y: 200 },
          data: { label: 'Yes end', end_reason: 'success' },
        },
        {
          id: 'end-no',
          type: 'end',
          position: { x: 100, y: 200 },
          data: { label: 'No end', end_reason: 'failure' },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'condition1' },
        { id: 'e2', source: 'condition1', target: 'end-yes', sourceHandle: 'true' },
        { id: 'e3', source: 'condition1', target: 'end-no', sourceHandle: 'false' },
      ],
    }

    const result = exportFlowToVapiConfig(flow)

    expect(result.system_prompt).toContain('Evaluate condition')
    expect(result.system_prompt).toContain('intent === "affirmative"')
  })

  test('should validate and reject invalid flows', () => {
    const invalidFlow: ConversationFlow = {
      tenant_id: 'test',
      name: 'Invalid Flow',
      version: 1,
      nodes: [], // No nodes!
      edges: [],
    }

    expect(() => exportFlowToVapiConfig(invalidFlow)).toThrow(
      /Cannot export invalid flow/
    )
  })

  test('should validate flow with orphaned nodes', () => {
    const flow: ConversationFlow = {
      tenant_id: 'test',
      name: 'Flow with orphaned node',
      version: 1,
      nodes: [
        {
          id: 'start',
          type: 'speak',
          position: { x: 0, y: 0 },
          data: { label: 'Start', message: 'Hello' },
        },
        {
          id: 'orphan',
          type: 'speak',
          position: { x: 100, y: 100 },
          data: { label: 'Orphan', message: 'Never reached' },
        },
      ],
      edges: [], // No edges connecting them
    }

    const validation = validateFlow(flow)

    expect(validation.valid).toBe(true) // Still valid, just has warnings
    expect(validation.warnings.length).toBeGreaterThan(0)
    expect(validation.warnings[0]).toContain('orphaned')
  })

  test('should export flow with MCP tool bridge', () => {
    const flow: ConversationFlow = {
      tenant_id: 'test',
      name: 'MCP Tool Flow',
      version: 1,
      nodes: [
        {
          id: 'start',
          type: 'speak',
          position: { x: 0, y: 0 },
          data: { label: 'Greeting', message: 'Hello' },
        },
        {
          id: 'mcp-call',
          type: 'tool',
          position: { x: 0, y: 100 },
          data: {
            label: 'Call Supabase',
            tool_type: 'mcp_tool',
            tool_name: 'execute_sql',
            parameters: { query: 'SELECT * FROM users' },
          },
        },
        {
          id: 'end',
          type: 'end',
          position: { x: 0, y: 200 },
          data: { label: 'End', end_reason: 'success' },
        },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'mcp-call' },
        { id: 'e2', source: 'mcp-call', target: 'end' },
      ],
    }

    const result = exportFlowToVapiConfig(flow)

    expect(result.assistant_config.tools).toBeDefined()
    const mcpTool = result.assistant_config.tools!.find(
      (t) => t.function.name === 'callMCPTool'
    )
    expect(mcpTool).toBeDefined()
    expect(mcpTool!.server.url).toContain('/api/tools/mcp-bridge')
  })

  test('should handle transfer node in export', () => {
    const flow: ConversationFlow = {
      tenant_id: 'test',
      name: 'Transfer Flow',
      version: 1,
      nodes: [
        {
          id: 'start',
          type: 'speak',
          position: { x: 0, y: 0 },
          data: { label: 'Start', message: 'Transferring you now...' },
        },
        {
          id: 'transfer',
          type: 'transfer',
          position: { x: 0, y: 100 },
          data: {
            label: 'Transfer to support',
            transfer_type: 'human',
            destination: '+15555555555',
            transfer_message: 'Please hold.',
          },
        },
      ],
      edges: [{ id: 'e1', source: 'start', target: 'transfer' }],
    }

    const result = exportFlowToVapiConfig(flow)

    expect(result.system_prompt).toContain('Transfer call to human')
    expect(result.system_prompt).toContain('+15555555555')
  })
})
