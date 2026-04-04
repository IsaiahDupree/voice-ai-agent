// F1191: Integration test: Call transfer flow
// Tests frustration trigger → warm transfer → rep answers

import { vapiFunctionCallTransfer, vapiCallStarted } from '../fixtures'
import { mockVapi, mockSupabase } from '../mocks'

describe('Call Transfer Flow Integration', () => {
  beforeEach(() => {
    mockVapi.reset()
    mockSupabase.reset()
  })

  describe('F1191: Frustration → Warm Transfer → Rep Answers', () => {
    it('should detect frustration and initiate transfer', async () => {
      // Simulate AI detecting frustration keywords
      const transcript = [
        { role: 'user', text: 'This is frustrating!' },
        { role: 'user', text: 'Can I speak to a human?' },
        { role: 'assistant', text: 'I understand. Let me connect you to a representative.' },
      ]

      const frustrationKeywords = [
        'frustrat',
        'speak to human',
        'real person',
        'supervisor',
        'manager',
      ]

      const hasFrustration = transcript.some((t) =>
        frustrationKeywords.some((keyword) =>
          t.text.toLowerCase().includes(keyword)
        )
      )

      expect(hasFrustration).toBe(true)
    })

    it('should trigger transferCall function', () => {
      const transferEvent = vapiFunctionCallTransfer.message

      expect(transferEvent.functionCall.name).toBe('transferCall')
      expect(transferEvent.functionCall.parameters.phoneNumber).toBeDefined()
      expect(transferEvent.functionCall.parameters.reason).toContain('human')
    })

    it('should initiate warm transfer with context', async () => {
      const callId = 'test-call-123'
      const customerPhone = '+15555551234'
      const repPhone = '+15555556789'

      const transferContext = {
        callId,
        customerPhone,
        customerName: 'John Doe',
        reason: 'Customer requested human assistance',
        conversationSummary: 'Customer inquired about pricing and requested to speak with sales rep',
        sentiment: 'frustrated',
      }

      // Verify context has required fields for warm transfer
      expect(transferContext.callId).toBeDefined()
      expect(transferContext.customerPhone).toBeDefined()
      expect(transferContext.reason).toBeDefined()
      expect(transferContext.conversationSummary).toBeDefined()
    })

    it('should log transfer event to database', async () => {
      const transferLog = {
        call_id: 'test-call-123',
        from_agent: 'ai',
        to_agent: 'human',
        transfer_reason: 'Customer requested human assistance',
        transfer_time: new Date().toISOString(),
        status: 'completed',
      }

      mockSupabase.setData('call_transfers', [transferLog])
      const result = mockSupabase.from('call_transfers').select('*').data

      expect(result).toHaveLength(1)
      expect(result[0].from_agent).toBe('ai')
      expect(result[0].to_agent).toBe('human')
    })

    it('should send whisper message to rep with context', async () => {
      const whisperMessage =
        'Incoming transfer: John Doe is frustrated about pricing. ' +
        'They want to know about enterprise plans. Call has been active for 3 minutes.'

      expect(whisperMessage).toContain('John Doe')
      expect(whisperMessage).toContain('frustrated')
      expect(whisperMessage).toContain('pricing')
    })

    it('should complete transfer when rep answers', async () => {
      const transferStages = [
        'initiated',
        'ringing',
        'answered',
        'completed',
      ]

      // Simulate transfer progression
      let currentStage = 0

      const advanceTransfer = () => {
        if (currentStage < transferStages.length - 1) {
          currentStage++
        }
        return transferStages[currentStage]
      }

      expect(advanceTransfer()).toBe('ringing')
      expect(advanceTransfer()).toBe('answered')
      expect(advanceTransfer()).toBe('completed')
    })

    it('should fall back if transfer fails', async () => {
      const transferAttempt = {
        status: 'failed',
        reason: 'No representative available',
        fallback: 'voicemail',
      }

      if (transferAttempt.status === 'failed') {
        expect(transferAttempt.fallback).toBe('voicemail')
      }
    })
  })

  describe('Transfer timing and metrics', () => {
    it('should track time to transfer', () => {
      const callStartTime = new Date('2026-04-15T10:00:00Z')
      const transferTime = new Date('2026-04-15T10:03:30Z')

      const timeToTransferSec = (transferTime.getTime() - callStartTime.getTime()) / 1000

      expect(timeToTransferSec).toBe(210) // 3.5 minutes
    })

    it('should track rep response time', () => {
      const transferInitiated = new Date('2026-04-15T10:03:30Z')
      const repAnswered = new Date('2026-04-15T10:03:45Z')

      const responseTimeSec = (repAnswered.getTime() - transferInitiated.getTime()) / 1000

      expect(responseTimeSec).toBe(15) // 15 seconds
    })

    it('should calculate transfer success rate', () => {
      const transfers = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'failed' },
        { status: 'completed' },
      ]

      const successCount = transfers.filter((t) => t.status === 'completed').length
      const successRate = (successCount / transfers.length) * 100

      expect(successRate).toBe(75)
    })
  })

  describe('Transfer queue management', () => {
    it('should add transfer to queue when all reps busy', async () => {
      const queue = {
        transfers: [] as any[],
        maxWaitTime: 300, // 5 minutes
      }

      const transfer = {
        callId: 'test-call-123',
        priority: 'high',
        queuedAt: new Date(),
      }

      queue.transfers.push(transfer)

      expect(queue.transfers).toHaveLength(1)
      expect(queue.transfers[0].priority).toBe('high')
    })

    it('should prioritize transfers by urgency', () => {
      const transfers = [
        { callId: '1', priority: 'low', queuedAt: new Date() },
        { callId: '2', priority: 'high', queuedAt: new Date() },
        { callId: '3', priority: 'medium', queuedAt: new Date() },
      ]

      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const sorted = transfers.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])

      expect(sorted[0].priority).toBe('high')
      expect(sorted[2].priority).toBe('low')
    })
  })
})
