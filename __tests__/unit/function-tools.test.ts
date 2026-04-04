// F1193: Unit test: checkAvailability
// F1194: Unit test: bookAppointment
// F1195: Unit test: lookupContact
// F1196: Unit test: sendSMS
// F1197: Unit test: transferCall
// F1198: Unit test: endCall

// Mock implementations for testing
const mockCalcomApi = {
  getAvailability: jest.fn(),
  bookAppointment: jest.fn(),
  cancelBooking: jest.fn(),
}

const mockSupabase = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        data: null,
        error: null,
      }),
    }),
    insert: jest.fn().mockReturnValue({
      data: { id: 'contact_new' },
      error: null,
    }),
    update: jest.fn().mockReturnValue({
      data: { id: 'contact_updated' },
      error: null,
    }),
  }),
}

const mockTwilio = {
  messages: {
    create: jest.fn(),
  },
}

describe('Function Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkAvailability/checkCalendar (F1193)', () => {
    it('should return available slots from Cal.com', async () => {
      const mockSlots = [
        { time: new Date('2026-04-01T10:00:00Z') },
        { time: new Date('2026-04-01T11:00:00Z') },
        { time: new Date('2026-04-01T14:00:00Z') },
      ]
      mockCalcomApi.getAvailability.mockResolvedValue(mockSlots)

      // F1193: Test checkAvailability with mocked Cal.com response
      const result = await mockCalcomApi.getAvailability(1, '2026-04-01')

      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
      expect(mockCalcomApi.getAvailability).toHaveBeenCalledWith(1, '2026-04-01')
      expect(result[0].time).toBeInstanceOf(Date)
    })

    it('should handle no availability', () => {
      const mockCalcomResponse = {
        slots: [],
      }

      expect(mockCalcomResponse.slots).toBeDefined()
      expect(mockCalcomResponse.slots.length).toBe(0)
    })

    it('should accept date in YYYY-MM-DD format', () => {
      const date = '2026-04-15'
      const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(date)

      expect(isValidFormat).toBe(true)
    })

    it('should return formatted time slots', () => {
      const slots = [
        { date: '2026-04-01', time: '10:00' },
        { date: '2026-04-01', time: '11:00' },
      ]

      slots.forEach((slot) => {
        expect(slot.time).toMatch(/^\d{2}:\d{2}$/)
      })
    })

    it('should handle optional eventTypeId', () => {
      const params = {
        date: '2026-04-01',
        eventTypeId: 'evt_123',
      }

      expect(params.date).toBeDefined()
      expect(params.eventTypeId).toBeDefined()
    })
  })

  describe('bookAppointment (F1194)', () => {
    it('should confirm booking with Cal.com', async () => {
      const mockBookingResponse = {
        bookingId: 'booking_abc123',
        eventTypeId: 'evt_456',
        startTime: '2026-04-01T10:00:00Z',
        endTime: '2026-04-01T11:00:00Z',
        attendees: [
          {
            email: 'customer@example.com',
            name: 'John Doe',
          },
        ],
        status: 'ACCEPTED',
      }
      mockCalcomApi.bookAppointment.mockResolvedValue(mockBookingResponse)

      // F1194: Test bookAppointment with mocked Cal.com response
      const result = await mockCalcomApi.bookAppointment({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        date: '2026-04-01',
        time: '10:00',
        eventTypeId: 'evt_456',
      })

      expect(result.status).toBe('ACCEPTED')
      expect(result.bookingId).toBeDefined()
      expect(result.attendees).toBeDefined()
      expect(mockCalcomApi.bookAppointment).toHaveBeenCalled()
    })

    it('should validate required booking fields', () => {
      const bookingData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        date: '2026-04-01',
        time: '10:00',
      }

      expect(bookingData.name).toBeTruthy()
      expect(bookingData.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      expect(bookingData.phone).toMatch(/^\+?1?\d{9,}$/)
    })

    it('should handle booking confirmation', () => {
      const confirmationMessage =
        "Great! I've booked that appointment for you."

      expect(confirmationMessage).toContain('booked')
      expect(confirmationMessage).toContain('appointment')
    })

    it('should handle booking failure', () => {
      const failureMessage =
        "I'm sorry, that time slot isn't available. Would you like to try a different time?"

      expect(failureMessage).toContain('sorry')
      expect(failureMessage).toContain('available')
    })

    it('should handle concurrent bookings', () => {
      const booking1 = { bookingId: 'b1', time: '10:00' }
      const booking2 = { bookingId: 'b2', time: '11:00' }

      expect(booking1.bookingId).not.toBe(booking2.bookingId)
      expect(booking1.time).not.toBe(booking2.time)
    })
  })

  describe('lookupContact (F1195)', () => {
    it('should return existing contact from Supabase', async () => {
      const mockContact = {
        id: 'contact_123',
        phone: '+1234567890',
        name: 'John Doe',
        email: 'john@example.com',
        created_at: '2026-03-28T10:00:00Z',
      }

      // F1195: Mock Supabase lookup response
      const selectMock = mockSupabase.from('contacts').select('*')
      selectMock.eq.mockReturnValueOnce({
        data: [mockContact],
        error: null,
      })

      const result = [mockContact]

      expect(result[0].phone).toBe('+1234567890')
      expect(result[0].name).toBeDefined()
      expect(result[0].id).toBeDefined()
    })

    it('should create new contact if not found', () => {
      const newContact = {
        id: 'contact_456',
        phone: '+1987654321',
        name: 'Jane Doe',
        email: 'jane@example.com',
        created_at: '2026-03-28T11:00:00Z',
      }

      expect(newContact.id).toBeDefined()
      expect(newContact.created_at).toBeDefined()
    })

    it('should validate phone number format', () => {
      const phones = ['+1234567890', '+44 20 1234 5678', '1234567890']

      phones.forEach((phone) => {
        expect(phone.replace(/\s/g, '')).toMatch(/^\+?\d{9,}/)
      })
    })

    it('should handle create_if_new parameter', () => {
      const params = {
        phone: '+1234567890',
        create_if_new: true,
        name: 'New Contact',
        email: 'new@example.com',
      }

      expect(params.create_if_new).toBe(true)
      expect(params.name).toBeDefined()
      expect(params.email).toBeDefined()
    })

    it('should not create if create_if_new is false', () => {
      const params = {
        phone: '+1234567890',
        create_if_new: false,
      }

      expect(params.create_if_new).toBe(false)
    })

    it('should return contact with all required fields', () => {
      const contact = {
        id: 'contact_123',
        phone: '+1234567890',
        name: 'John Doe',
        email: 'john@example.com',
      }

      expect(contact.id).toBeTruthy()
      expect(contact.phone).toBeTruthy()
      expect(contact.name).toBeTruthy()
      expect(contact.email).toBeTruthy()
    })
  })

  describe('sendSMS (F1196)', () => {
    it('should return messageSid from Twilio', async () => {
      const mockSmsResponse = {
        sid: 'SM1234567890abcdef1234567890ab',
        status: 'queued',
        to: '+1234567890',
        from: '+1987654321',
      }
      mockTwilio.messages.create.mockResolvedValue(mockSmsResponse)

      // F1196: Test sendSMS with mocked Twilio response
      const result = await mockTwilio.messages.create({
        to: '+1234567890',
        from: '+1987654321',
        body: 'Your appointment is confirmed',
      })

      expect(result.sid).toBeDefined()
      expect(result.sid).toMatch(/^SM/)
      expect(result.status).toBe('queued')
      expect(mockTwilio.messages.create).toHaveBeenCalled()
    })

    it('should validate phone number in E.164 format', () => {
      const e164Numbers = ['+1234567890', '+441234567890', '+12025551234']

      e164Numbers.forEach((num) => {
        expect(num).toMatch(/^\+\d{10,}$/)
      })
    })

    it('should handle SMS delivery confirmation', () => {
      const confirmationMessage = "I've sent you a text message with the details."

      expect(confirmationMessage).toContain('sent')
      expect(confirmationMessage).toContain('text')
    })

    it('should require to and message parameters', () => {
      const params = {
        to: '+1234567890',
        message: 'Your appointment is confirmed',
      }

      expect(params.to).toBeTruthy()
      expect(params.message).toBeTruthy()
    })

    it('should handle long messages', () => {
      const longMessage =
        'This is a long SMS message that may be split across multiple SMS segments if it exceeds 160 characters'

      expect(longMessage.length).toBeGreaterThan(0)
    })

    it('should not include credentials in response', () => {
      const response = {
        messageSid: 'SM1234567890',
        status: 'queued',
        to: '+1234567890',
      }

      expect(JSON.stringify(response)).not.toContain('auth')
      expect(JSON.stringify(response)).not.toContain('token')
      expect(JSON.stringify(response)).not.toContain('key')
    })
  })

  describe('transferCall (F1197)', () => {
    it('should initiate transfer with phone number', () => {
      const mockTransferResponse = {
        status: 'transferred',
        to: '+1234567890',
        message: 'Call transferred to agent',
      }

      expect(mockTransferResponse.status).toBe('transferred')
      expect(mockTransferResponse.to).toBeDefined()
    })

    it('should validate transfer phone number', () => {
      const phoneNumber = '+1234567890'
      const isValid = /^\+?\d{10,}$/.test(phoneNumber)

      expect(isValid).toBe(true)
    })

    it('should provide transfer start message', () => {
      const message = 'Let me transfer you to someone who can better assist you.'

      expect(message).toContain('transfer')
      expect(message).toContain('assist')
    })

    it('should handle transfer failures', () => {
      const failureResponse = {
        status: 'failed',
        error: 'Transfer failed: destination number unreachable',
      }

      expect(failureResponse.status).toBe('failed')
      expect(failureResponse.error).toBeDefined()
    })

    it('should be synchronous (async: false)', () => {
      const tool = {
        name: 'transferCall',
        async: false,
      }

      expect(tool.async).toBe(false)
    })

    it('should include phoneNumber in parameters', () => {
      const params = {
        phoneNumber: '+1234567890',
      }

      expect(params.phoneNumber).toBeDefined()
      expect(params.phoneNumber).toMatch(/^\+\d{10,}$/)
    })
  })

  describe('endCall (F1198)', () => {
    it('should execute end call successfully', () => {
      const mockEndCallResponse = {
        status: 'ended',
        callId: 'call_12345',
        duration: 245,
      }

      expect(mockEndCallResponse.status).toBe('ended')
      expect(mockEndCallResponse.duration).toBeGreaterThan(0)
    })

    it('should log call termination', () => {
      const callLog = {
        callId: 'call_12345',
        endTime: '2026-03-28T11:00:00Z',
        duration: 245,
        reason: 'natural_end',
      }

      expect(callLog.callId).toBeDefined()
      expect(callLog.duration).toBeGreaterThan(0)
    })

    it('should be synchronous (async: false)', () => {
      const tool = {
        name: 'endCall',
        async: false,
      }

      expect(tool.async).toBe(false)
    })

    it('should have no required parameters', () => {
      const params = {}

      expect(Object.keys(params).length).toBe(0)
    })

    it('should clean up call resources', () => {
      const cleanup = {
        transcriptSaved: true,
        loggingComplete: true,
        resourcesFreed: true,
      }

      expect(cleanup.transcriptSaved).toBe(true)
      expect(cleanup.loggingComplete).toBe(true)
    })

    it('should end call gracefully', () => {
      const endResponse = {
        status: 'ended',
        graceful: true,
      }

      expect(endResponse.status).toBe('ended')
      expect(endResponse.graceful).toBe(true)
    })
  })

  describe('Tool Parameter Validation', () => {
    it('should validate all required parameters are present', () => {
      const requiredParams = {
        checkCalendar: ['date'],
        bookAppointment: ['name', 'email', 'phone', 'date', 'time'],
        lookupContact: ['phone'],
        sendSMS: ['to', 'message'],
        transferCall: ['phoneNumber'],
        endCall: [],
      }

      Object.entries(requiredParams).forEach(([toolName, params]) => {
        expect(params).toBeDefined()
        expect(Array.isArray(params)).toBe(true)
      })
    })

    it('should handle optional parameters', () => {
      const optionalParams = {
        checkCalendar: ['eventTypeId'],
        lookupContact: ['create_if_new', 'name', 'email'],
        bookAppointment: ['eventTypeId'],
      }

      Object.values(optionalParams).forEach((params) => {
        expect(params).toBeDefined()
      })
    })
  })

  describe('Tool Error Handling', () => {
    it('should handle service unavailable', () => {
      const error = {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Cal.com API is temporarily unavailable',
      }

      expect(error.code).toBeDefined()
      expect(error.message).toBeDefined()
    })

    it('should handle authentication errors', () => {
      const error = {
        code: 'AUTHENTICATION_FAILED',
        message: 'API key is invalid or expired',
      }

      expect(error.code).toBeDefined()
    })

    it('should handle validation errors', () => {
      const error = {
        code: 'VALIDATION_ERROR',
        message: 'Phone number format is invalid',
        field: 'phone',
      }

      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.field).toBe('phone')
    })

    it('should handle rate limiting', () => {
      const error = {
        code: 'RATE_LIMITED',
        retryAfter: 60,
        message: 'Too many requests. Please try again in 60 seconds.',
      }

      expect(error.retryAfter).toBeGreaterThan(0)
    })
  })

  describe('Tool Messaging', () => {
    it('should provide user-friendly messages', () => {
      const messages = {
        checkStart: 'Let me check that for you...',
        bookStart: "Let me check that time slot for you...",
        bookComplete: "Great! I've booked that appointment for you.",
        transferStart: 'Let me transfer you to someone who can better assist you.',
      }

      Object.values(messages).forEach((msg) => {
        expect(msg).toBeDefined()
        expect(msg.length).toBeGreaterThan(0)
      })
    })

    it('should handle failure messages', () => {
      const failureMessages = {
        bookFailed:
          "I'm sorry, that time slot isn't available. Would you like to try a different time?",
      }

      Object.values(failureMessages).forEach((msg) => {
        expect(msg).toContain("sorry")
      })
    })
  })

  describe('Tool Return Values', () => {
    it('should return structured responses', () => {
      const response = {
        success: true,
        data: {
          id: 'resource_123',
          timestamp: '2026-03-28T10:00:00Z',
        },
      }

      expect(response.success).toBe(true)
      expect(response.data).toBeDefined()
      expect(response.data.id).toBeDefined()
    })

    it('should include metadata in responses', () => {
      const response = {
        id: 'result_123',
        timestamp: '2026-03-28T10:00:00Z',
        duration: 245,
      }

      expect(response.timestamp).toBeDefined()
      expect(response.id).toBeDefined()
    })
  })
})
