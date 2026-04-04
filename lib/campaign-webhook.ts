// F0233: Outbound webhook - POST campaign events to external webhook URL

export async function sendCampaignWebhook(event: {
  event_type: 'campaign_started' | 'campaign_completed' | 'campaign_paused' | 'call_completed' | 'booking_made'
  campaign_id: string
  campaign_name?: string
  data?: any
  timestamp?: string
}) {
  try {
    const webhookUrl = process.env.CAMPAIGN_WEBHOOK_URL

    if (!webhookUrl) {
      console.log('CAMPAIGN_WEBHOOK_URL not configured, skipping webhook')
      return { success: false, reason: 'not_configured' }
    }

    const payload = {
      event: event.event_type,
      timestamp: event.timestamp || new Date().toISOString(),
      campaign: {
        id: event.campaign_id,
        name: event.campaign_name,
      },
      data: event.data || {},
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceAIAgent/1.0',
        'X-Event-Type': event.event_type,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Campaign webhook failed: ${response.status} - ${errorText}`)
      return {
        success: false,
        status: response.status,
        error: errorText,
      }
    }

    console.log(`Campaign webhook sent: ${event.event_type} for campaign ${event.campaign_id}`)
    return { success: true, status: response.status }
  } catch (error: any) {
    console.error('Campaign webhook error:', error)
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

export async function notifyCampaignStart(campaignId: string, campaignName: string, contactCount: number) {
  return sendCampaignWebhook({
    event_type: 'campaign_started',
    campaign_id: campaignId,
    campaign_name: campaignName,
    data: {
      contact_count: contactCount,
    },
  })
}

export async function notifyCampaignComplete(campaignId: string, campaignName: string, results: any) {
  return sendCampaignWebhook({
    event_type: 'campaign_completed',
    campaign_id: campaignId,
    campaign_name: campaignName,
    data: {
      results,
    },
  })
}

export async function notifyCallComplete(campaignId: string, callId: string, outcome: string, duration?: number) {
  return sendCampaignWebhook({
    event_type: 'call_completed',
    campaign_id: campaignId,
    data: {
      call_id: callId,
      outcome,
      duration_seconds: duration,
    },
  })
}

export async function notifyBookingMade(campaignId: string, callId: string, bookingId: string, contactInfo: any) {
  return sendCampaignWebhook({
    event_type: 'booking_made',
    campaign_id: campaignId,
    data: {
      call_id: callId,
      booking_id: bookingId,
      contact: contactInfo,
    },
  })
}
