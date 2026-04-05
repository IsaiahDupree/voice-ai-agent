/**
 * Feature 190: Unit Test - Flow Simulator
 * Tests that flow simulator correctly handles all node types
 */

import { simulateConversationFlow } from '@/lib/flow-simulator'
import type { ConversationFlow } from '@/lib/flow-types'

describe('Flow Simulator Unit Tests', () => {
  test('should simulate SpeakNode → ListenNode → EndNode flow', async () => {
    const flow: ConversationFlow = {
      tenant_id: 'test',
      name: 'Simple Conversation',
      version: 1,
      nodes: [
        {
          id: 'speak1',
          type: 'speak',
          position: { x: 0, y: 0 },
          data: {
            label: 'Greeting',
            message: 'Hello {{caller_name}}, how are you?',
          },
        },
        {
          id: 'listen1',
          type: 'listen',
          position: { x: 0, y: 100 },
          data: {
            label: 'Listen',
            expected_intents: ['affirmative', 'negative'],
          },
        },
        {
          id: 'end1',
          type: 'end',
          position: { x: 0, y: 200 },
          data: {
            label: 'End',
            end_reason: 'success',
            final_message: 'Goodbye!',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'speak1', target: 'listen1' },
        { id: 'e2', source: 'listen1', target: 'end1' },
      ],
    }

    const result = await simulateConversationFlow(
      flow,
      ['yes, I am doing great!'], // User response
      { caller_name: 'John' }
    )

    expect(result.flow_name).toBe('Simple Conversation')
    expect(result.final_outcome).toBe('success')
    expect(result.steps.length).toBe(3) // speak, listen, end

    // Verify SpeakNode step
    const speakStep = result.steps[0]
    expect(speakStep.current_node_type).toBe('speak')
    expect(speakStep.agent_message).toContain('Hello John')

    // Verify ListenNode step
    const listenStep = result.steps[1]
    expect(listenStep.current_node_type).toBe('listen')
    expect(listenStep.user_input).toBe('yes, I am doing great!')
    expect(listenStep.extracted_intent).toBe('affirmative')

    // Verify EndNode step
    const endStep = result.steps[2]
    expect(endStep.current_node_type).toBe('end')
    expect(endStep.agent_message).toBe('Goodbye!')
    expect(endStep.conversation_ended).toBe(true)
    expect(endStep.end_reason).toBe('success')
  })

  test('should handle ConditionNode branching correctly', async () => {
    const flow: ConversationFlow = {
      tenant_id: 'test',
      name: 'Conditional Flow',
      version: 1,
      nodes: [
        {
          id: 'speak1',
          type: 'speak',
          position: { x: 0, y: 0 },
          data: { label: 'Ask', message: 'Do you want to continue?' },
        },
        {
          id: 'listen1',
          type: 'listen',
          position: { x: 0, y: 100 },
          data: {
            label: 'Listen',
            expected_intents: ['affirmative', 'negative'],
          },
        },
        {
          id: 'condition1',
          type: 'condition',
          position: { x: 0, y: 200 },
          data: {
            label: 'Check intent',
            condition_type: 'intent',
            condition: 'intent === "affirmative"',
            branches: {},
          },
        },
        {
          id: 'end-yes',
          type: 'end',
          position: { x: -100, y: 300 },
          data: {
            label: 'Yes path',
            end_reason: 'success',
            final_message: 'Great!',
          },
        },
        {
          id: 'end-no',
          type: 'end',
          position: { x: 100, y: 300 },
          data: {
            label: 'No path',
            end_reason: 'failure',
            final_message: 'Okay, goodbye.',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'speak1', target: 'listen1' },
        { id: 'e2', source: 'listen1', target: 'condition1' },
        {
          id: 'e3',
          source: 'condition1',
          target: 'end-yes',
          label: 'true',
          sourceHandle: 'true',
        },
        {
          id: 'e4',
          source: 'condition1',
          target: 'end-no',
          label: 'false',
          sourceHandle: 'false',
        },
      ],
    }

    // Test affirmative path
    const result1 = await simulateConversationFlow(flow, ['yes'], {})
    expect(result1.final_outcome).toBe('success')
    const conditionStep1 = result1.steps.find((s) => s.current_node_type === 'condition')
    expect(conditionStep1?.condition_result).toBe(true)

    // Test negative path
    const result2 = await simulateConversationFlow(flow, ['no'], {})
    expect(result2.final_outcome).toBe('failure')
    const conditionStep2 = result2.steps.find((s) => s.current_node_type === 'condition')
    expect(conditionStep2?.condition_result).toBe(false)
  })

  test('should simulate ToolNode with mock results', async () => {
    const flow: ConversationFlow = {
      tenant_id: 'test',
      name: 'Tool Call Flow',
      version: 1,
      nodes: [
        {
          id: 'speak1',
          type: 'speak',
          position: { x: 0, y: 0 },
          data: { label: 'Start', message: 'Checking calendar...' },
        },
        {
          id: 'tool1',
          type: 'tool',
          position: { x: 0, y: 100 },
          data: {
            label: 'Check Calendar',
            tool_type: 'vapi_function',
            tool_name: 'checkCalendar',
            parameters: { date: '2026-04-05' },
            store_result_as: 'calendar_slots',
            on_success_message: 'Found {{calendar_slots.available_slots.length}} slots.',
          },
        },
        {
          id: 'end1',
          type: 'end',
          position: { x: 0, y: 200 },
          data: { label: 'End', end_reason: 'success' },
        },
      ],
      edges: [
        { id: 'e1', source: 'speak1', target: 'tool1' },
        { id: 'e2', source: 'tool1', target: 'end1' },
      ],
    }

    const result = await simulateConversationFlow(flow, [], {})

    const toolStep = result.steps.find((s) => s.current_node_type === 'tool')
    expect(toolStep).toBeDefined()
    expect(toolStep!.tool_call).toBeDefined()
    expect(toolStep!.tool_call!.tool_name).toBe('checkCalendar')
    expect(toolStep!.tool_call!.result.success).toBe(true)
    expect(toolStep!.tool_call!.result.available_slots).toBeDefined()

    // Verify result stored in context
    expect(result.conversation_context.calendar_slots).toBeDefined()
  })

  test('should handle TransferNode', async () => {
    const flow: ConversationFlow = {
      tenant_id: 'test',
      name: 'Transfer Flow',
      version: 1,
      nodes: [
        {
          id: 'speak1',
          type: 'speak',
          position: { x: 0, y: 0 },
          data: { label: 'Start', message: 'Transferring...' },
        },
        {
          id: 'transfer1',
          type: 'transfer',
          position: { x: 0, y: 100 },
          data: {
            label: 'Transfer',
            transfer_type: 'human',
            destination: '+15555555555',
            transfer_message: 'Please hold.',
          },
        },
      ],
      edges: [{ id: 'e1', source: 'speak1', target: 'transfer1' }],
    }

    const result = await simulateConversationFlow(flow, [], {})

    expect(result.final_outcome).toBe('success')
    const transferStep = result.steps.find((s) => s.current_node_type === 'transfer')
    expect(transferStep).toBeDefined()
    expect(transferStep!.agent_message).toContain('TRANSFER')
    expect(transferStep!.conversation_ended).toBe(true)
  })

  test('should timeout when no user inputs provided for ListenNode', async () => {
    const flow: ConversationFlow = {
      tenant_id: 'test',
      name: 'Timeout Flow',
      version: 1,
      nodes: [
        {
          id: 'speak1',
          type: 'speak',
          position: { x: 0, y: 0 },
          data: { label: 'Ask', message: 'Are you there?' },
        },
        {
          id: 'listen1',
          type: 'listen',
          position: { x: 0, y: 100 },
          data: {
            label: 'Listen',
            expected_intents: ['affirmative'],
            timeout_seconds: 10,
          },
        },
      ],
      edges: [{ id: 'e1', source: 'speak1', target: 'listen1' }],
    }

    const result = await simulateConversationFlow(flow, [], {}) // No inputs = timeout

    expect(result.final_outcome).toBe('timeout')
    const listenStep = result.steps.find((s) => s.current_node_type === 'listen')
    expect(listenStep?.end_reason).toBe('timeout')
  })

  test('should interpolate variables in messages', async () => {
    const flow: ConversationFlow = {
      tenant_id: 'test',
      name: 'Variable Interpolation',
      version: 1,
      nodes: [
        {
          id: 'speak1',
          type: 'speak',
          position: { x: 0, y: 0 },
          data: {
            label: 'Greeting',
            message:
              'Hello {{caller_name}}, you have called {{call_count}} times from {{caller_phone}}.',
          },
        },
        {
          id: 'end1',
          type: 'end',
          position: { x: 0, y: 100 },
          data: { label: 'End', end_reason: 'success' },
        },
      ],
      edges: [{ id: 'e1', source: 'speak1', target: 'end1' }],
    }

    const result = await simulateConversationFlow(flow, [], {
      caller_name: 'Alice',
      caller_phone: '+15551234567',
      call_count: 3,
    })

    const speakStep = result.steps[0]
    expect(speakStep.agent_message).toContain('Hello Alice')
    expect(speakStep.agent_message).toContain('called 3 times')
    expect(speakStep.agent_message).toContain('+15551234567')
  })

  test('should prevent infinite loops (max 100 steps)', async () => {
    // Create a flow with a cycle
    const flow: ConversationFlow = {
      tenant_id: 'test',
      name: 'Infinite Loop',
      version: 1,
      nodes: [
        {
          id: 'speak1',
          type: 'speak',
          position: { x: 0, y: 0 },
          data: { label: 'Loop', message: 'Looping...' },
        },
      ],
      edges: [{ id: 'e1', source: 'speak1', target: 'speak1' }], // Self-loop!
    }

    const result = await simulateConversationFlow(flow, [], {})

    expect(result.total_steps).toBeLessThanOrEqual(100)
    expect(result.final_outcome).toBe('error') // Should detect infinite loop
  })
})
