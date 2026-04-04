// F0543: SMS inbound webhook - receive SMS from Twilio

import { NextRequest, NextResponse } from 'next/server'
import { processInboundSMS } from '@/lib/sms-two-way'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

/**
 * F0543: Handle inbound SMS webhook from Twilio
 * Twilio sends POST request with form-encoded data
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await request.formData()

    const payload = {
      from: formData.get('From') as string,
      to: formData.get('To') as string,
      body: formData.get('Body') as string,
      messageSid: formData.get('MessageSid') as string,
      accountSid: formData.get('AccountSid') as string,
      timestamp: new Date().toISOString(),
    }

    if (!payload.from || !payload.to || !payload.body) {
      return apiError(ErrorCodes.BAD_REQUEST, 'Missing required fields from Twilio', 400)
    }

    // Process inbound SMS
    const result = await processInboundSMS(payload)

    console.log(`✓ Inbound SMS processed: ${payload.from} → ${payload.to}`)

    // Twilio expects TwiML response (optional)
    // If auto-reply was sent, we can confirm with empty TwiML
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${result.autoReply ? `<Message>${result.autoReply}</Message>` : ''}
</Response>`

    return new NextResponse(twimlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error: any) {
    console.error('Inbound SMS webhook error:', error)

    // Return 200 to Twilio even on error to avoid retries
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    )
  }
}

/**
 * GET handler for webhook verification
 */
export async function GET(request: NextRequest) {
  return apiSuccess({ status: 'SMS inbound webhook is active' })
}
