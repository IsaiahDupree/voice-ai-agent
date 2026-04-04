// F0168: Call metadata webhook - POST caller metadata to CRM webhook on connect

export async function sendCallMetadataToWebhook(callData: {
  call_id: string
  from_number: string | null
  to_number: string | null
  direction: string
  contact_id: string | null
  contact_name: string | null
  started_at: string
  assistant_id: string
  metadata?: any
}) {
  try {
    const webhookUrl = process.env.CRM_WEBHOOK_URL

    if (!webhookUrl) {
      console.log('CRM_WEBHOOK_URL not configured, skipping webhook')
      return { success: false, reason: 'not_configured' }
    }

    const payload = {
      event: 'call.connected',
      timestamp: new Date().toISOString(),
      call: {
        id: callData.call_id,
        from: callData.from_number,
        to: callData.to_number,
        direction: callData.direction,
        started_at: callData.started_at,
        assistant_id: callData.assistant_id,
      },
      contact: callData.contact_id ? {
        id: callData.contact_id,
        name: callData.contact_name,
      } : null,
      metadata: callData.metadata || {},
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceAIAgent/1.0',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`CRM webhook failed: ${response.status} - ${errorText}`)
      return {
        success: false,
        status: response.status,
        error: errorText
      }
    }

    console.log(`CRM webhook sent successfully for call ${callData.call_id}`)
    return { success: true, status: response.status }
  } catch (error: any) {
    console.error('CRM webhook error:', error)
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}
