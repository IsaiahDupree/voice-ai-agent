// F1232: Vapi call-started fixture
// F1233: Vapi call-ended fixture
// F1234: Vapi transcript fixture
// F1235: Vapi function-call fixture

/**
 * F1232: Vapi call-started event fixture
 */
export const vapiCallStarted = {
  message: {
    type: 'call-started',
    call: {
      id: 'test-call-123',
      assistantId: 'test-assistant-456',
      status: 'in-progress',
      type: 'outbound',
      phoneNumberId: 'test-phone-789',
      customer: {
        number: '+15555551234',
      },
      startedAt: new Date().toISOString(),
    },
  },
}

/**
 * F1233: Vapi call-ended event fixture
 */
export const vapiCallEnded = {
  message: {
    type: 'call-ended',
    call: {
      id: 'test-call-123',
      assistantId: 'test-assistant-456',
      status: 'ended',
      type: 'outbound',
      phoneNumberId: 'test-phone-789',
      customer: {
        number: '+15555551234',
      },
      startedAt: new Date(Date.now() - 180000).toISOString(), // 3 min ago
      endedAt: new Date().toISOString(),
      duration: 180,
      cost: 0.0234,
      endedReason: 'customer-ended',
    },
  },
}

/**
 * F1234: Vapi transcript event fixture
 */
export const vapiTranscript = {
  message: {
    type: 'transcript',
    transcriptType: 'partial',
    call: {
      id: 'test-call-123',
      assistantId: 'test-assistant-456',
    },
    transcript: {
      role: 'user',
      text: 'Hi, I would like to book an appointment',
      timestamp: new Date().toISOString(),
    },
  },
}

export const vapiTranscriptFinal = {
  message: {
    type: 'transcript',
    transcriptType: 'final',
    call: {
      id: 'test-call-123',
      assistantId: 'test-assistant-456',
    },
    transcript: {
      role: 'assistant',
      text: 'Sure! I can help you book an appointment. What date works best for you?',
      timestamp: new Date().toISOString(),
    },
  },
}

/**
 * F1235: Vapi function-call event fixture
 */
export const vapiFunctionCall = {
  message: {
    type: 'function-call',
    functionCall: {
      name: 'bookAppointment',
      parameters: {
        date: '2026-04-15',
        time: '14:00',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+15555551234',
      },
    },
    call: {
      id: 'test-call-123',
      assistantId: 'test-assistant-456',
      customer: {
        number: '+15555551234',
      },
    },
  },
}

export const vapiFunctionCallCalendar = {
  message: {
    type: 'function-call',
    functionCall: {
      name: 'checkCalendar',
      parameters: {
        date: '2026-04-15',
        timezone: 'America/New_York',
      },
    },
    call: {
      id: 'test-call-123',
      assistantId: 'test-assistant-456',
    },
  },
}

/**
 * Vapi end-call function call
 */
export const vapiFunctionCallEndCall = {
  message: {
    type: 'function-call',
    functionCall: {
      name: 'endCall',
      parameters: {
        reason: 'Customer requested to end call',
      },
    },
    call: {
      id: 'test-call-123',
      assistantId: 'test-assistant-456',
    },
  },
}

/**
 * Vapi transfer-call function call
 */
export const vapiFunctionCallTransfer = {
  message: {
    type: 'function-call',
    functionCall: {
      name: 'transferCall',
      parameters: {
        phoneNumber: '+15555556789',
        reason: 'Customer needs human assistance',
      },
    },
    call: {
      id: 'test-call-123',
      assistantId: 'test-assistant-456',
      customer: {
        number: '+15555551234',
      },
    },
  },
}
