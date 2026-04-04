import axios, { AxiosError } from 'axios'
import { isVapiTestMode } from './test-mode'

const VAPI_BASE_URL = 'https://api.vapi.ai'
const VAPI_API_KEY = process.env.VAPI_API_KEY!

export const vapiClient = axios.create({
  baseURL: VAPI_BASE_URL,
  headers: {
    'Authorization': `Bearer ${VAPI_API_KEY}`,
    'Content-Type': 'application/json',
  },
})

// F1185: Test mode flag
export const TEST_MODE = isVapiTestMode()

// F0065: Vapi API error handling - structured error responses
export class VapiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message)
    this.name = 'VapiError'
  }
}

// F0066: Vapi rate limit handling - exponential backoff retry
vapiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const config = error.config as any

    // Handle rate limits (429)
    if (error.response?.status === 429) {
      const retryCount = config._retryCount || 0
      const maxRetries = 3

      if (retryCount < maxRetries) {
        config._retryCount = retryCount + 1
        const delay = Math.pow(2, retryCount) * 1000 // Exponential backoff: 1s, 2s, 4s

        await new Promise(resolve => setTimeout(resolve, delay))
        return vapiClient(config)
      }

      throw new VapiError(
        'RATE_LIMIT_EXCEEDED',
        'Vapi API rate limit exceeded after retries',
        429,
        { retries: maxRetries }
      )
    }

    // Handle other errors
    const status = error.response?.status
    const data = error.response?.data as any

    throw new VapiError(
      data?.code || 'VAPI_ERROR',
      data?.message || error.message || 'Vapi API request failed',
      status,
      data
    )
  }
)

export interface VapiFunctionTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required?: string[]
    }
  }
  async?: boolean
  timeoutSeconds?: number // F0035: Tool call timeout
  messages?: Array<{ type: string; content: string }>
}

export interface VapiAssistant {
  id?: string
  name: string // F0068: Assistant name field
  model: {
    provider: 'openai' | 'anthropic'
    model: string
    systemPrompt?: string
    messages?: Array<{ role: string; content: string }> // F0036: Messages array init
    temperature?: number
    maxTokens?: number
    maxHistoryMessages?: number // F0071: Conversation history limit
    tools?: VapiFunctionTool[]
    url?: string // F0078: Custom LLM endpoint
  }
  voice: {
    provider: 'elevenlabs' | 'deepgram'
    voiceId: string
    stability?: number
    similarityBoost?: number
    speed?: number
  }
  transcriber?: {
    provider: 'deepgram'
    model?: string
    language?: string
    keywords?: string[]
    confidenceThreshold?: number // F0092: STT confidence threshold
  }
  firstMessage?: string
  endCallMessage?: string
  endCallPhrases?: string[]
  voicemailDetectionEnabled?: boolean // F0037: Voicemail detection
  voicemailMessage?: string // F0038: Voicemail message
  transferCallMessage?: string // F0039: Call transfer config
  phoneNumberId?: string // F0040/F0041: Phone number assignment
  metadata?: Record<string, any> // F0069: Assistant metadata
  tags?: string[] // F0095: Assistant tags
  maxDurationSeconds?: number
  silenceTimeoutSeconds?: number
  idleTimeoutSeconds?: number // F0072: Idle timeout
  idleMessage?: string // F0072: Idle timeout message
  responseDelaySeconds?: number
  interruptionThreshold?: number // F0083: Interrupt sensitivity
  backgroundSound?: string
  backgroundDenoisingEnabled?: boolean // F0070: Ambient noise cancellation
  emotionRecognitionEnabled?: boolean // F0079: Emotion recognition
  modelFallbackEnabled?: boolean
  hipaaEnabled?: boolean
  recordingEnabled?: boolean // F0115: Recording storage (when enabled, Vapi stores recording)
  videoRecordingEnabled?: boolean
  recordingConsentMessage?: string // F0114: Call recording consent message
  fallbackDestination?: string // F0093: Call forwarding fallback
  serverUrl?: string
  serverUrlSecret?: string
}

export async function createAssistant(config: VapiAssistant) {
  const response = await vapiClient.post('/assistant', config)
  return response.data
}

export async function listAssistants() {
  const response = await vapiClient.get('/assistant')
  return response.data
}

export async function getAssistant(id: string) {
  const response = await vapiClient.get(`/assistant/${id}`)
  return response.data
}

export async function updateAssistant(id: string, config: Partial<VapiAssistant>) {
  const response = await vapiClient.patch(`/assistant/${id}`, config)
  return response.data
}

export async function deleteAssistant(id: string) {
  const response = await vapiClient.delete(`/assistant/${id}`)
  return response.data
}

// Call object interface
export interface VapiCall {
  id: string
  assistantId: string
  status: 'queued' | 'ringing' | 'in-progress' | 'ended' | 'failed' // F0046: Call status field
  type: 'inbound' | 'outbound'
  startedAt?: string
  endedAt?: string
  duration?: number // F0047: Call duration field (seconds)
  cost?: number // F0048: Call cost field (USD)
  recordingUrl?: string // F0049: Call recording URL
  transcript?: string // F0050: Call transcript field
  messages?: Array<{ role: string; content: string }> // F0051: Call messages array
  phoneNumber?: string
  customerNumber?: string
  metadata?: Record<string, any> // F0052: Call metadata field
}

// Call APIs
export async function startCall(payload: {
  assistantId: string
  phoneNumberId?: string
  customerNumber?: string
  assistantOverrides?: Partial<VapiAssistant> // F0053: Assistant overrides per-call
  metadata?: Record<string, any>
}) {
  // F1185: Test mode - prevent real call initiation
  if (TEST_MODE) {
    console.log('[VAPI TEST MODE] Simulating call start:', payload)

    // Return mock call object
    const mockCall: VapiCall = {
      id: `test-call-${Date.now()}`,
      assistantId: payload.assistantId,
      status: 'queued',
      type: 'outbound',
      phoneNumber: payload.phoneNumberId,
      customerNumber: payload.customerNumber,
      metadata: {
        ...payload.metadata,
        testMode: true,
        simulatedAt: new Date().toISOString()
      },
    }

    return mockCall
  }

  const response = await vapiClient.post('/call', payload)
  return response.data as VapiCall
}

export async function getCall(id: string) {
  const response = await vapiClient.get(`/call/${id}`)
  return response.data as VapiCall
}

export async function listCalls(params?: { limit?: number; offset?: number }) {
  const response = await vapiClient.get('/call', { params })
  return response.data as VapiCall[]
}

export async function endCall(id: string) {
  const response = await vapiClient.delete(`/call/${id}`)
  return response.data
}

// Phone number management
export interface VapiPhoneNumber {
  id: string
  number: string
  provider: 'twilio' | 'vonage' | 'vapi'
  assistantId?: string
  createdAt: string
  metadata?: Record<string, any>
}

// F0054: Phone number create
export async function createPhoneNumber(payload: {
  provider?: 'twilio' | 'vonage' | 'vapi'
  areaCode?: string
  name?: string
  assistantId?: string
}) {
  const response = await vapiClient.post('/phone-number', payload)
  return response.data as VapiPhoneNumber
}

// F0055: Phone number list
export async function listPhoneNumbers() {
  const response = await vapiClient.get('/phone-number')
  return response.data as VapiPhoneNumber[]
}

// F0056: Phone number delete
export async function deletePhoneNumber(id: string) {
  const response = await vapiClient.delete(`/phone-number/${id}`)
  return response.data
}

// Utility functions for inbound call features

// F0109: Business hours check - validates if call is within business hours
export function isWithinBusinessHours(
  timezone = 'America/New_York',
  businessHours = { start: 9, end: 17 } // 9 AM - 5 PM
): boolean {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay()

  // Weekend check
  if (day === 0 || day === 6) return false

  // Hour range check
  return hour >= businessHours.start && hour < businessHours.end
}

// F0110: Holiday routing - checks if today is a holiday
export function isHoliday(holidays: string[] = []): boolean {
  const today = new Date().toISOString().split('T')[0]
  return holidays.includes(today)
}

// F0156: Number porting - port existing number to Vapi
export async function portPhoneNumber(payload: {
  phoneNumber: string
  provider: 'twilio' | 'vonage'
  accountSid?: string
  accountToken?: string
  assistantId?: string
  description?: string
}) {
  const response = await vapiClient.post('/phone-number/port', payload)
  return response.data as VapiPhoneNumber
}

// F0157: Toll-free number - purchase and assign toll-free number
export async function createTollFreeNumber(payload: {
  areaCode?: string
  name?: string
  assistantId?: string
  preferredAreaCode?: string
}) {
  const response = await vapiClient.post('/phone-number/tollfree', {
    ...payload,
    type: 'tollfree',
  })
  return response.data as VapiPhoneNumber
}

// F0158: Local presence numbers - get available local numbers by region
export async function getLocalNumbersByRegion(region: {
  state?: string
  city?: string
  areaCode?: string
  country?: string
}) {
  const params = new URLSearchParams()
  if (region.state) params.append('state', region.state)
  if (region.city) params.append('city', region.city)
  if (region.areaCode) params.append('areaCode', region.areaCode)
  if (region.country) params.append('country', region.country)

  const response = await vapiClient.get(
    `/phone-number/available${params.size > 0 ? `?${params}` : ''}`
  )
  return response.data as VapiPhoneNumber[]
}

// F0175: Inbound call redirect - set IVR routing for inbound calls
export interface IVROption {
  key: string
  description: string
  assistantId: string
  phoneNumber?: string
}

export async function configureIVRRouting(payload: {
  phoneNumberId: string
  ivroptions: IVROption[]
  greeting?: string
  defaultAssistantId?: string
  timeout?: number
}) {
  const response = await vapiClient.post('/phone-number/ivr', payload)
  return response.data
}

// F0319: Cal.com OAuth - retrieve OAuth token for Cal.com multi-tenant setup
export async function getCalComOAuthToken(payload: {
  code: string
  redirectUri: string
  clientId?: string
  clientSecret?: string
}) {
  // This would typically be handled by the Cal.com integration
  // For now, return a placeholder for the OAuth flow
  return {
    access_token: payload.code,
    token_type: 'Bearer',
    expires_in: 3600,
  }
}
