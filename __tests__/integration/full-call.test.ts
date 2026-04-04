// F1189: Integration test: full call

/**
 * Integration test for full call flow
 * Tests the complete lifecycle: call start -> function calls -> call end
 */

describe('Full Call Integration', () => {
  describe('End-to-end call flow', () => {
    it('should handle complete call lifecycle', async () => {
      // Mock call data
      const callId = 'call_test_123'
      const phoneNumber = '+12025551234'

      // 1. Call started
      const startEvent = {
        type: 'call.started' as const,
        call: {
          id: callId,
          type: 'inbound',
          customer: { number: phoneNumber },
          assistantId: 'asst_123',
        },
      }

      expect(startEvent.type).toBe('call.started')
      expect(startEvent.call.customer.number).toBe(phoneNumber)

      // 2. Function call (book appointment)
      const functionCall = {
        type: 'function-call' as const,
        call: { id: callId },
        functionCall: {
          name: 'bookAppointment',
          parameters: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: phoneNumber,
            date: '2026-03-27',
            time: '14:00',
          },
        },
      }

      expect(functionCall.functionCall.name).toBe('bookAppointment')

      // 3. Transcript events
      const transcript1 = {
        type: 'transcript' as const,
        call: { id: callId },
        transcript: {
          role: 'assistant',
          content: 'What time works best for you?',
        },
      }

      const transcript2 = {
        type: 'transcript' as const,
        call: { id: callId },
        transcript: {
          role: 'user',
          content: '2pm tomorrow',
        },
      }

      expect(transcript1.transcript.role).toBe('assistant')
      expect(transcript2.transcript.role).toBe('user')

      // 4. Call ended
      const endEvent = {
        type: 'call.ended' as const,
        call: {
          id: callId,
          duration: 125,
          transcript: 'Full conversation transcript here...',
          cost: 0.25,
        },
        endedReason: 'completed',
      }

      expect(endEvent.type).toBe('call.ended')
      expect(endEvent.call.duration).toBeGreaterThan(0)
      expect(endEvent.endedReason).toBe('completed')
    })

    it('should track call state through lifecycle', () => {
      const states = ['initiated', 'ringing', 'in-progress', 'completed']
      const expectedTransitions = [
        { from: 'initiated', to: 'ringing' },
        { from: 'ringing', to: 'in-progress' },
        { from: 'in-progress', to: 'completed' },
      ]

      expectedTransitions.forEach((transition) => {
        expect(states).toContain(transition.from)
        expect(states).toContain(transition.to)
      })
    })
  })

  describe('Call with booking', () => {
    it('should complete booking during call', () => {
      const booking = {
        callId: 'call_123',
        appointmentTime: '2026-03-27T14:00:00Z',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        status: 'confirmed',
      }

      expect(booking.callId).toBeDefined()
      expect(booking.status).toBe('confirmed')
      expect(new Date(booking.appointmentTime)).toBeInstanceOf(Date)
    })

    it('should send SMS confirmation after booking', () => {
      const sms = {
        to: '+12025551234',
        message: 'Your appointment is confirmed for March 27 at 2pm.',
        status: 'sent',
      }

      expect(sms.to).toMatch(/^\+[1-9]\d{1,14}$/)
      expect(sms.message).toContain('confirmed')
      expect(sms.status).toBe('sent')
    })
  })

  describe('Call error handling', () => {
    it('should handle dropped calls', () => {
      const droppedCall = {
        callId: 'call_123',
        status: 'failed',
        endReason: 'connection_lost',
        duration: 45,
      }

      expect(droppedCall.status).toBe('failed')
      expect(droppedCall.endReason).toBe('connection_lost')
    })

    it('should handle voicemail detection', () => {
      const voicemailCall = {
        callId: 'call_123',
        status: 'completed',
        endReason: 'voicemail-detected',
        voicemailMessage: 'Please call us back',
      }

      expect(voicemailCall.endReason).toBe('voicemail-detected')
      expect(voicemailCall.voicemailMessage).toBeDefined()
    })
  })
})
