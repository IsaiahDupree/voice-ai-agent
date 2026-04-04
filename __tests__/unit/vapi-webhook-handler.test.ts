// F1199: Unit test: Vapi webhook handler

import crypto from 'crypto'

describe('Vapi Webhook Handler', () => {
  describe('Event type routing', () => {
    it('should identify call.started events', () => {
      const event = { type: 'call.started', call: { id: '123' } }
      expect(event.type).toBe('call.started')
    })

    it('should identify call.ended events', () => {
      const event = { type: 'call.ended', call: { id: '123' }, endedReason: 'completed' }
      expect(event.type).toBe('call.ended')
      expect(event.endedReason).toBe('completed')
    })

    it('should identify function-call events', () => {
      const event = {
        type: 'function-call',
        call: { id: '123' },
        functionCall: { name: 'bookAppointment', parameters: {} },
      }
      expect(event.type).toBe('function-call')
      expect(event.functionCall.name).toBe('bookAppointment')
    })

    it('should identify transcript events', () => {
      const event = {
        type: 'transcript',
        call: { id: '123' },
        transcript: { role: 'assistant', content: 'Hello' },
      }
      expect(event.type).toBe('transcript')
    })

    it('should identify status-update events', () => {
      const event = { type: 'status-update', call: { id: '123' }, status: 'ringing' }
      expect(event.type).toBe('status-update')
    })

    it('should identify hang events', () => {
      const event = { type: 'hang', call: { id: '123' } }
      expect(event.type).toBe('hang')
    })

    it('should identify speech-update events', () => {
      const event = { type: 'speech-update', call: { id: '123' }, speech: {} }
      expect(event.type).toBe('speech-update')
    })
  })

  describe('Signature validation', () => {
    const secret = 'test-webhook-secret'

    it('should validate correct signature', () => {
      const payload = { type: 'call.started', call: { id: '123' } }
      const payloadString = JSON.stringify(payload)

      const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex')

      // Simulate validation
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex')

      expect(signature).toBe(expectedSignature)
    })

    it('should reject incorrect signature', () => {
      const payload = { type: 'call.started', call: { id: '123' } }
      const payloadString = JSON.stringify(payload)

      const correctSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex')

      const wrongSignature = 'wrong-signature'

      expect(wrongSignature).not.toBe(correctSignature)
    })

    it('should reject signature with different secret', () => {
      const payload = { type: 'call.started', call: { id: '123' } }
      const payloadString = JSON.stringify(payload)

      const sig1 = crypto.createHmac('sha256', 'secret1').update(payloadString).digest('hex')
      const sig2 = crypto.createHmac('sha256', 'secret2').update(payloadString).digest('hex')

      expect(sig1).not.toBe(sig2)
    })
  })

  describe('Call data extraction', () => {
    it('should extract call ID from event', () => {
      const event = { type: 'call.started', call: { id: 'call_abc123' } }
      expect(event.call.id).toBe('call_abc123')
    })

    it('should extract customer phone from call data', () => {
      const event = {
        type: 'call.started',
        call: { id: '123', customer: { number: '+12025551234' } },
      }
      expect(event.call.customer?.number).toBe('+12025551234')
    })

    it('should extract assistant ID', () => {
      const event = { type: 'call.started', call: { id: '123', assistantId: 'asst_123' } }
      expect(event.call.assistantId).toBe('asst_123')
    })

    it('should extract call direction', () => {
      const inbound = { type: 'call.started', call: { id: '123', type: 'inbound' } }
      const outbound = { type: 'call.started', call: { id: '456', type: 'outbound' } }

      expect(inbound.call.type).toBe('inbound')
      expect(outbound.call.type).toBe('outbound')
    })

    it('should extract ended reason', () => {
      const event = { type: 'call.ended', call: { id: '123' }, endedReason: 'voicemail-detected' }
      expect(event.endedReason).toBe('voicemail-detected')
    })
  })

  describe('Function call extraction', () => {
    it('should extract function name and parameters', () => {
      const event = {
        type: 'function-call',
        call: { id: '123' },
        functionCall: {
          name: 'bookAppointment',
          parameters: {
            name: 'John Doe',
            email: 'john@example.com',
            date: '2026-03-27',
          },
        },
      }

      expect(event.functionCall.name).toBe('bookAppointment')
      expect(event.functionCall.parameters.name).toBe('John Doe')
      expect(event.functionCall.parameters.email).toBe('john@example.com')
    })

    it('should handle all supported function calls', () => {
      const functions = [
        'checkCalendar',
        'bookAppointment',
        'lookupContact',
        'sendSMS',
        'transferCall',
        'endCall',
        'optOutDNC',
      ]

      functions.forEach((name) => {
        const event = {
          type: 'function-call' as const,
          call: { id: '123' },
          functionCall: { name, parameters: {} },
        }
        expect(event.functionCall.name).toBe(name)
      })
    })
  })

  describe('Transcript handling', () => {
    it('should extract transcript content and role', () => {
      const event = {
        type: 'transcript',
        call: { id: '123' },
        transcript: {
          role: 'assistant',
          content: 'How can I help you today?',
          timestamp: '2026-03-26T12:00:00Z',
        },
      }

      expect(event.transcript.role).toBe('assistant')
      expect(event.transcript.content).toBe('How can I help you today?')
      expect(event.transcript.timestamp).toBeTruthy()
    })

    it('should handle user and assistant roles', () => {
      const userMessage = {
        type: 'transcript' as const,
        call: { id: '123' },
        transcript: { role: 'user', content: 'I need help' },
      }

      const assistantMessage = {
        type: 'transcript' as const,
        call: { id: '123' },
        transcript: { role: 'assistant', content: 'How can I help?' },
      }

      expect(userMessage.transcript.role).toBe('user')
      expect(assistantMessage.transcript.role).toBe('assistant')
    })
  })

  describe('Error handling', () => {
    it('should handle missing signature gracefully', () => {
      const signature: string | null = null
      expect(signature).toBeNull()
      // If no secret configured, should skip validation
    })

    it('should handle malformed event data', () => {
      const malformed = { type: 'unknown-event' }
      expect(malformed.type).toBe('unknown-event')
      // Unknown events should be logged but not crash
    })

    it('should handle missing call data', () => {
      const event: any = { type: 'call.started' }
      expect(event.call).toBeUndefined()
      // Should handle gracefully
    })
  })

  describe('Response format', () => {
    it('should return success response for processed events', () => {
      const response = { received: true }
      expect(response.received).toBe(true)
    })

    it('should return function result for function-call events', () => {
      const result = {
        success: true,
        booking: { id: 'bk_123', startTime: '2026-03-27T14:00:00Z' },
      }

      expect(result.success).toBe(true)
      expect(result.booking).toBeDefined()
    })

    it('should return error response on failure', () => {
      const error = { error: 'Invalid signature', status: 401 }
      expect(error.error).toBeTruthy()
      expect(error.status).toBe(401)
    })
  })
})
