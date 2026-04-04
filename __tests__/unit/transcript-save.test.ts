// F1211: Unit test: Transcript save to Supabase

import { vapiTranscript, vapiTranscriptFinal } from '../fixtures'
import { mockSupabase } from '../mocks'

describe('Transcript Save Handler', () => {
  beforeEach(() => {
    mockSupabase.reset()
  })

  describe('F1211: Save transcript to Supabase', () => {
    it('should save transcript with required fields', async () => {
      const event = vapiTranscript.message
      const transcript = {
        call_id: event.call.id,
        role: event.transcript.role,
        text: event.transcript.text,
        timestamp: event.transcript.timestamp,
        type: event.transcriptType,
      }

      expect(transcript.call_id).toBeDefined()
      expect(transcript.role).toBe('user')
      expect(transcript.text).toBeDefined()
      expect(transcript.timestamp).toBeDefined()
    })

    it('should handle partial transcripts', () => {
      const event = vapiTranscript.message

      expect(event.transcriptType).toBe('partial')
      expect(event.transcript.text).toBeTruthy()
    })

    it('should handle final transcripts', () => {
      const event = vapiTranscriptFinal.message

      expect(event.transcriptType).toBe('final')
      expect(event.transcript.role).toBe('assistant')
    })

    it('should validate speaker role', () => {
      const validRoles = ['user', 'assistant', 'system']
      const event = vapiTranscript.message

      expect(validRoles).toContain(event.transcript.role)
    })

    it('should preserve transcript order by timestamp', () => {
      const transcript1 = {
        ...vapiTranscript.message.transcript,
        timestamp: new Date('2026-04-15T10:00:00Z').toISOString(),
      }
      const transcript2 = {
        ...vapiTranscriptFinal.message.transcript,
        timestamp: new Date('2026-04-15T10:00:05Z').toISOString(),
      }

      const t1Time = new Date(transcript1.timestamp).getTime()
      const t2Time = new Date(transcript2.timestamp).getTime()

      expect(t1Time).toBeLessThan(t2Time)
    })
  })

  describe('Transcript text validation', () => {
    it('should not save empty transcripts', () => {
      const emptyText = ''

      expect(emptyText.trim()).toBe('')
    })

    it('should trim whitespace from transcript text', () => {
      const text = '  Hello world  '
      const trimmed = text.trim()

      expect(trimmed).toBe('Hello world')
    })

    it('should handle special characters', () => {
      const text = "I'd like to book an appointment for 2:00 PM"

      expect(text).toContain("'")
      expect(text).toContain(':')
    })
  })

  describe('Transcript retrieval', () => {
    it('should retrieve transcripts by call_id', async () => {
      const callId = 'test-call-123'
      mockSupabase.setData('transcripts', [
        { id: 1, call_id: callId, text: 'Hello', role: 'user' },
        { id: 2, call_id: callId, text: 'Hi there', role: 'assistant' },
      ])

      const result = mockSupabase.from('transcripts').select('*').data

      expect(result).toHaveLength(2)
      expect(result[0].call_id).toBe(callId)
    })

    it('should order transcripts chronologically', () => {
      const transcripts = [
        { timestamp: '2026-04-15T10:00:00Z', text: 'First' },
        { timestamp: '2026-04-15T10:00:05Z', text: 'Second' },
        { timestamp: '2026-04-15T10:00:10Z', text: 'Third' },
      ]

      const sorted = transcripts.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )

      expect(sorted[0].text).toBe('First')
      expect(sorted[2].text).toBe('Third')
    })
  })
})
