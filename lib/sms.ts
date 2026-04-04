// SMS utility functions using Twilio
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_PHONE_NUMBER

let twilioClient: ReturnType<typeof twilio> | null = null

function getTwilioClient() {
  if (!twilioClient && accountSid && authToken) {
    twilioClient = twilio(accountSid, authToken)
  }
  return twilioClient
}

export function isTwilioTestMode(): boolean {
  // Test mode if credentials not configured or using test SID
  return !accountSid || !authToken || accountSid.startsWith('AC000000000')
}

export interface SendSMSParams {
  to: string
  body: string
  from?: string
  mediaUrl?: string[] // F0419: MMS support
}

export interface SendSMSResult {
  sid: string
  status: string
  to: string
  from: string
  success: boolean
}

export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  const { to, body, from = fromNumber, mediaUrl } = params

  if (isTwilioTestMode()) {
    // Return mock response in test mode
    console.log('[SMS Test Mode] Would send:', { to, body, from, mediaUrl })
    return {
      sid: `SM${Date.now()}`,
      status: 'queued',
      to,
      from: from || '+1234567890',
      success: true,
    }
  }

  if (!from) {
    throw new Error('TWILIO_PHONE_NUMBER not configured')
  }

  const client = getTwilioClient()
  if (!client) {
    throw new Error('Twilio client not initialized')
  }

  const messageParams: any = {
    to,
    from,
    body,
  }

  // F0419: Add mediaUrl for MMS
  if (mediaUrl && mediaUrl.length > 0) {
    messageParams.mediaUrl = mediaUrl
  }

  const message = await client.messages.create(messageParams)

  return {
    sid: message.sid,
    status: message.status,
    to: message.to,
    from: message.from,
    success: message.status !== 'failed',
  }
}

// Validate E.164 phone number format
export function validatePhoneNumber(phone: string): boolean {
  return /^\+?[1-9]\d{1,14}$/.test(phone)
}

// Format phone to E.164
export function formatE164(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')

  // If 10 digits (US number), add +1
  if (digits.length === 10) {
    return `+1${digits}`
  }

  // If 11 digits starting with 1 (US number with country code), add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  // Otherwise return as-is with + prefix
  return digits.startsWith('+') ? digits : `+${digits}`
}
