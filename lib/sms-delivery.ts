// F0413: sendSMS delivery status polling

import { supabaseAdmin } from './supabase'
import { getTwilioCredentials } from './test-mode'

const twilio = require('twilio')

/**
 * F0413: Poll Twilio for SMS delivery status
 * Returns: queued, sent, delivered, failed, undelivered
 */
export async function checkSMSDeliveryStatus(
  messageSid: string
): Promise<{
  status: string
  errorCode?: string
  errorMessage?: string
  dateUpdated?: string
}> {
  const twilioConfig = getTwilioCredentials()

  // Test mode - return mock delivered status
  if (twilioConfig.isTest || messageSid.startsWith('TEST')) {
    return {
      status: 'delivered',
      dateUpdated: new Date().toISOString()
    }
  }

  try {
    const twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken)

    const message = await twilioClient.messages(messageSid).fetch()

    return {
      status: message.status,
      errorCode: message.errorCode || undefined,
      errorMessage: message.errorMessage || undefined,
      dateUpdated: message.dateUpdated?.toISOString()
    }
  } catch (error: any) {
    console.error(`Error fetching SMS delivery status for ${messageSid}:`, error)
    throw new Error(`Failed to check delivery status: ${error.message}`)
  }
}

/**
 * F0413: Update SMS log with delivery status
 */
export async function updateSMSDeliveryStatus(
  messageSid: string
): Promise<{ status: string; updated: boolean }> {
  try {
    const deliveryStatus = await checkSMSDeliveryStatus(messageSid)

    // Update database
    const { error } = await supabaseAdmin
      .from('sms_logs')
      .update({
        status: deliveryStatus.status,
        error_code: deliveryStatus.errorCode,
        error_message: deliveryStatus.errorMessage,
        delivered_at:
          deliveryStatus.status === 'delivered'
            ? deliveryStatus.dateUpdated
            : null,
        updated_at: new Date().toISOString()
      })
      .eq('message_sid', messageSid)

    if (error) {
      console.error('Error updating SMS delivery status in DB:', error)
    }

    return {
      status: deliveryStatus.status,
      updated: !error
    }
  } catch (error: any) {
    console.error('Error in updateSMSDeliveryStatus:', error)
    return {
      status: 'unknown',
      updated: false
    }
  }
}

/**
 * F0413: Poll for delivery with retry
 * Checks status every N seconds until delivered/failed or max attempts reached
 */
export async function pollSMSDelivery(
  messageSid: string,
  options: {
    maxAttempts?: number
    intervalMs?: number
  } = {}
): Promise<string> {
  const maxAttempts = options.maxAttempts || 10
  const intervalMs = options.intervalMs || 2000

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { status } = await updateSMSDeliveryStatus(messageSid)

    // Terminal states
    if (['delivered', 'failed', 'undelivered'].includes(status)) {
      console.log(
        `SMS ${messageSid} reached terminal state: ${status} (attempt ${attempt})`
      )
      return status
    }

    // Non-terminal states: queued, sent, sending
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }

  console.log(`SMS ${messageSid} polling timeout after ${maxAttempts} attempts`)
  return 'pending'
}
