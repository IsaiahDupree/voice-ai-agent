import { VapiFunctionTool } from './vapi'

export const checkCalendarTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'checkCalendar',
    description: 'Check calendar availability for a specific date',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date to check in YYYY-MM-DD format',
        },
        eventTypeId: {
          type: 'string',
          description: 'Optional event type ID',
        },
      },
      required: ['date'],
    },
  },
  async: true,
}

export const bookAppointmentTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'bookAppointment',
    description: 'Book an appointment on the calendar',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: "Customer's full name",
        },
        email: {
          type: 'string',
          description: "Customer's email address",
        },
        phone: {
          type: 'string',
          description: "Customer's phone number",
        },
        date: {
          type: 'string',
          description: 'Appointment date in YYYY-MM-DD format',
        },
        time: {
          type: 'string',
          description: 'Appointment time in HH:MM format (24-hour)',
        },
        eventTypeId: {
          type: 'string',
          description: 'Optional event type ID',
        },
      },
      required: ['name', 'email', 'phone', 'date', 'time'],
    },
  },
  async: true,
  messages: [
    {
      type: 'request-start',
      content: "Let me check that time slot for you...",
    },
    {
      type: 'request-complete',
      content: "Great! I've booked that appointment for you.",
    },
    {
      type: 'request-failed',
      content: "I'm sorry, that time slot isn't available. Would you like to try a different time?",
    },
  ],
}

export const lookupContactTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'lookupContact',
    description: 'Look up contact information by phone number',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number to look up',
        },
        // F0425: create_if_new parameter
        create_if_new: {
          type: 'boolean',
          description: 'If true, creates a new contact if not found',
        },
        name: {
          type: 'string',
          description: 'Name for new contact (used if create_if_new is true)',
        },
        email: {
          type: 'string',
          description: 'Email for new contact (used if create_if_new is true)',
        },
      },
      required: ['phone'],
    },
  },
  async: true,
}

export const sendSMSTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'sendSMS',
    description: 'Send an SMS message to a phone number',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Phone number to send to (E.164 format)',
        },
        message: {
          type: 'string',
          description: 'Message content',
        },
      },
      required: ['to', 'message'],
    },
  },
  async: true,
  messages: [
    {
      type: 'request-complete',
      content: "I've sent you a text message with the details.",
    },
  ],
}

export const transferCallTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'transferCall',
    description: 'Transfer the call to a human agent',
    parameters: {
      type: 'object',
      properties: {
        phoneNumber: {
          type: 'string',
          description: 'Phone number to transfer to',
        },
      },
      required: ['phoneNumber'],
    },
  },
  async: false,
  messages: [
    {
      type: 'request-start',
      content: "Let me transfer you to someone who can better assist you.",
    },
  ],
}

export const endCallTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'endCall',
    description: 'End the call',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  async: false,
}

// F0195: DNC self-service opt-out tool
export const optOutDNCTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'optOutDNC',
    description: 'Add caller to Do Not Call list (when they request to be removed)',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number to add to DNC list',
        },
        reason: {
          type: 'string',
          description: 'Reason for opt-out (optional)',
        },
      },
      required: ['phone'],
    },
  },
  async: true,
  messages: [
    {
      type: 'request-start',
      content: "I understand. Let me add you to our do not call list right away.",
    },
    {
      type: 'request-complete',
      content: "You've been added to our do not call list. You won't receive any more calls from us. Have a great day!",
    },
  ],
}

// F0428: Cancel booking tool
export const cancelBookingTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'cancelBooking',
    description: 'Cancel an existing booking by booking ID',
    parameters: {
      type: 'object',
      properties: {
        bookingId: {
          type: 'string',
          description: 'The booking ID or UID to cancel',
        },
        reason: {
          type: 'string',
          description: 'Reason for cancellation (optional)',
        },
      },
      required: ['bookingId'],
    },
  },
  async: true,
  messages: [
    {
      type: 'request-start',
      content: "Let me cancel that booking for you...",
    },
    {
      type: 'request-complete',
      content: "Your booking has been cancelled successfully. You'll receive a confirmation email shortly.",
    },
    {
      type: 'request-failed',
      content: "I'm sorry, I wasn't able to cancel that booking. Please try again or contact support.",
    },
  ],
}

// F0430: logCallNote tool - append note to CRM contact during call
export const logCallNoteTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'logCallNote',
    description: 'Log a note about the conversation to the contact record in CRM',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number of the contact',
        },
        note: {
          type: 'string',
          description: 'Note content to append to contact record',
        },
        category: {
          type: 'string',
          description: 'Note category (e.g., "interest", "objection", "follow-up", "general")',
          enum: ['interest', 'objection', 'follow-up', 'general', 'question'],
        },
      },
      required: ['phone', 'note'],
    },
  },
  async: true,
  messages: [
    {
      type: 'request-complete',
      content: "I've made a note of that in your record.",
    },
  ],
}

// F0386, F0387, F0388: updateContact tool - update contact fields including deal stage
export const updateContactTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'updateContact',
    description: 'Update contact information in CRM (name, email, deal stage, tags)',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number of the contact to update',
        },
        name: {
          type: 'string',
          description: 'Updated name',
        },
        email: {
          type: 'string',
          description: 'Updated email address',
        },
        deal_stage: {
          // F0388: deal_stage parameter
          type: 'string',
          description: 'Current deal stage',
          enum: ['lead', 'contacted', 'qualified', 'demo', 'proposal', 'negotiation', 'closed-won', 'closed-lost'],
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to add to contact',
        },
        company: {
          type: 'string',
          description: 'Company name',
        },
      },
      required: ['phone'],
    },
  },
  async: true,
  messages: [
    {
      type: 'request-complete',
      content: "I've updated your information in our system.",
    },
  ],
}

// F0390: getContactHistory tool - retrieve past interactions with contact
export const getContactHistoryTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'getContactHistory',
    description: 'Get past call and interaction history for a contact',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number of the contact',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of interactions to return (default 10)',
        },
      },
      required: ['phone'],
    },
  },
  async: true,
}

// F0391: searchContacts tool - search contacts by name or company
export const searchContactsTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'searchContacts',
    description: 'Search for contacts by name, company, or email',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (name, company, or email)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default 5)',
        },
      },
      required: ['query'],
    },
  },
  async: true,
}

// F0392: createTask tool - create a follow-up task
export const createTaskTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'createTask',
    description: 'Create a follow-up task for this contact',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number of the contact',
        },
        title: {
          type: 'string',
          description: 'Task title/description',
        },
        due_date: {
          type: 'string',
          description: 'Due date in YYYY-MM-DD format (optional)',
        },
        priority: {
          type: 'string',
          description: 'Task priority',
          enum: ['low', 'medium', 'high', 'urgent'],
        },
        type: {
          type: 'string',
          description: 'Task type',
          enum: ['call', 'email', 'meeting', 'follow-up', 'research', 'other'],
        },
      },
      required: ['phone', 'title'],
    },
  },
  async: true,
  messages: [
    {
      type: 'request-complete',
      content: "I've created that follow-up task in our system.",
    },
  ],
}

// F0427: getNextBooking tool - get next scheduled booking for contact
export const getNextBookingTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'getNextBooking',
    description: 'Get the next scheduled booking for a contact',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number of the contact',
        },
        email: {
          type: 'string',
          description: 'Email of the contact (alternative to phone)',
        },
      },
    },
  },
  async: true,
}

// F0429: addToWaitlist tool - add contact to event waitlist
export const addToWaitlistTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'addToWaitlist',
    description: 'Add contact to waitlist for a specific event or service',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number of the contact',
        },
        name: {
          type: 'string',
          description: 'Contact name',
        },
        email: {
          type: 'string',
          description: 'Contact email',
        },
        eventTypeId: {
          type: 'string',
          description: 'Event type or service ID for the waitlist',
        },
        notes: {
          type: 'string',
          description: 'Additional notes or preferences',
        },
      },
      required: ['phone', 'name', 'eventTypeId'],
    },
  },
  async: true,
  messages: [
    {
      type: 'request-start',
      content: "Let me add you to the waitlist...",
    },
    {
      type: 'request-complete',
      content: "You've been added to the waitlist! We'll notify you as soon as a spot opens up.",
    },
  ],
}

// RAG: Knowledge Base Search Tool
export const searchKnowledgeBaseTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'searchKnowledgeBase',
    description: 'Search the knowledge base for information to answer customer questions. Use this when you need to look up product details, pricing, policies, or other documented information.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The question or topic to search for in the knowledge base',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 3)',
        },
      },
      required: ['query'],
    },
  },
  async: true,
  messages: [
    {
      type: 'request-start',
      content: "Let me look that up for you...",
    },
    {
      type: 'request-complete',
      content: "I found the information you need.",
    },
    {
      type: 'request-failed',
      content: "I couldn't find any information about that in our knowledge base.",
    },
  ],
}

// Caller Memory: Get Caller Profile Tool
export const getCallerMemoryTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'getCallerMemory',
    description: 'Fetch caller history and preferences at the start of a call. Use this to personalize the conversation based on previous interactions.',
    parameters: {
      type: 'object',
      properties: {
        phoneNumber: {
          type: 'string',
          description: 'Caller phone number in E.164 format',
        },
      },
      required: ['phoneNumber'],
    },
  },
  async: true,
}

// Caller Memory: Update Caller Profile Tool
export const updateCallerMemoryTool: VapiFunctionTool = {
  type: 'function',
  function: {
    name: 'updateCallerMemory',
    description: 'Update caller profile after a call ends. Records call outcome, sentiment, offers made, and generates updated summary.',
    parameters: {
      type: 'object',
      properties: {
        phoneNumber: {
          type: 'string',
          description: 'Caller phone number in E.164 format',
        },
        callId: {
          type: 'string',
          description: 'Call ID for tracking',
        },
        name: {
          type: 'string',
          description: "Caller's name (if provided during call)",
        },
        transcript: {
          type: 'string',
          description: 'Call transcript for summary generation',
        },
        outcome: {
          type: 'string',
          description: 'Call outcome: completed, abandoned, transferred, or booking_made',
        },
        offerMade: {
          type: 'string',
          description: 'Description of any offer made during the call',
        },
        offerOutcome: {
          type: 'string',
          description: 'Outcome of offer: accepted, declined, or pending',
        },
        sentiment: {
          type: 'string',
          description: 'Overall call sentiment: positive, neutral, or negative',
        },
        notes: {
          type: 'string',
          description: 'Any additional notes about the call',
        },
      },
      required: ['phoneNumber', 'callId'],
    },
  },
  async: true,
}

// All function tools
export const allFunctionTools: VapiFunctionTool[] = [
  checkCalendarTool,
  bookAppointmentTool,
  cancelBookingTool, // F0428
  getNextBookingTool, // F0427
  lookupContactTool,
  getContactHistoryTool, // F0390
  searchContactsTool, // F0391
  logCallNoteTool, // F0430
  updateContactTool, // F0386, F0387, F0388
  createTaskTool, // F0392
  addToWaitlistTool, // F0429
  sendSMSTool,
  transferCallTool,
  endCallTool,
  optOutDNCTool,
  searchKnowledgeBaseTool, // RAG knowledge base search
  getCallerMemoryTool, // Caller memory: fetch profile
  updateCallerMemoryTool, // Caller memory: update profile
]

// Default sales assistant tools
export const salesAssistantTools: VapiFunctionTool[] = [
  lookupContactTool,
  logCallNoteTool, // F0430
  bookAppointmentTool,
  cancelBookingTool, // F0428
  sendSMSTool,
  transferCallTool,
  optOutDNCTool, // F0195: Allow callers to opt-out
  searchKnowledgeBaseTool, // RAG knowledge base search
  getCallerMemoryTool, // Caller memory
  updateCallerMemoryTool, // Caller memory
]

// Default support assistant tools
export const supportAssistantTools: VapiFunctionTool[] = [
  lookupContactTool,
  transferCallTool,
  endCallTool,
  searchKnowledgeBaseTool, // RAG knowledge base search
  getCallerMemoryTool, // Caller memory
]

// F1418: Tool definition JSON export
export function exportToolDefinitions(tools: VapiFunctionTool[]): string {
  const definitions = tools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
    async: tool.async ?? false,
  }))

  return JSON.stringify(definitions, null, 2)
}

// F1421: Tool param sanitization
export function sanitizeToolParams(params: Record<string, any>, toolDef: VapiFunctionTool): Record<string, any> {
  const sanitized: Record<string, any> = {}
  const schema = toolDef.function.parameters.properties || {}

  for (const [key, value] of Object.entries(params)) {
    const propDef = schema[key]
    if (!propDef) {
      // Skip unknown parameters
      continue
    }

    if (value === null || value === undefined) {
      // Keep null/undefined for optional params
      continue
    }

    // Type coercion and validation
    switch (propDef.type) {
      case 'string':
        sanitized[key] = String(value).trim()

        // Validate enum
        if (propDef.enum && !propDef.enum.includes(sanitized[key])) {
          throw new Error(`Invalid value for ${key}: must be one of ${propDef.enum.join(', ')}`)
        }

        // Validate format
        if (propDef.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized[key])) {
          throw new Error(`Invalid email format for ${key}`)
        }

        if (propDef.format === 'phone' && !/^\+?[1-9]\d{1,14}$/.test(sanitized[key])) {
          throw new Error(`Invalid phone format for ${key}`)
        }
        break

      case 'number':
      case 'integer':
        sanitized[key] = Number(value)

        if (isNaN(sanitized[key])) {
          throw new Error(`Invalid number for ${key}`)
        }

        if (propDef.minimum !== undefined && sanitized[key] < propDef.minimum) {
          throw new Error(`${key} must be >= ${propDef.minimum}`)
        }

        if (propDef.maximum !== undefined && sanitized[key] > propDef.maximum) {
          throw new Error(`${key} must be <= ${propDef.maximum}`)
        }

        if (propDef.type === 'integer' && !Number.isInteger(sanitized[key])) {
          sanitized[key] = Math.floor(sanitized[key])
        }
        break

      case 'boolean':
        sanitized[key] = Boolean(value)
        break

      case 'array':
        if (!Array.isArray(value)) {
          throw new Error(`${key} must be an array`)
        }
        sanitized[key] = value
        break

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          throw new Error(`${key} must be an object`)
        }
        sanitized[key] = value
        break

      default:
        sanitized[key] = value
    }
  }

  // Validate required parameters
  const required = toolDef.function.parameters.required || []
  for (const requiredParam of required) {
    if (!(requiredParam in sanitized)) {
      throw new Error(`Missing required parameter: ${requiredParam}`)
    }
  }

  return sanitized
}
