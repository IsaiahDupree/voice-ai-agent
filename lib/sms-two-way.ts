// F0543: SMS two-way - handle inbound SMS responses from contacts

import { supabaseAdmin } from '@/lib/supabase'
import { sendSMS } from '@/lib/sms'

export interface InboundSMSPayload {
  from: string // E.164 phone number
  to: string // Our Twilio number
  body: string
  messageSid: string
  accountSid: string
  timestamp?: string
}

/**
 * F0543: Process inbound SMS from Twilio webhook
 */
export async function processInboundSMS(payload: InboundSMSPayload): Promise<{
  contactId?: string
  threadId?: string
  autoReply?: string
}> {
  const supabase = supabaseAdmin
  const { from, to, body, messageSid, timestamp } = payload

  // Find or create contact
  let { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone', from)
    .single()

  if (contactError || !contact) {
    // Create new contact
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({
        phone: from,
        source: 'sms_inbound',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    contact = newContact
  }

  if (!contact) {
    throw new Error('Failed to find or create contact')
  }

  // Find active conversation thread (F0544)
  let { data: thread } = await supabase
    .from('sms_threads')
    .select('*')
    .eq('contact_id', contact.id)
    .eq('from_number', to)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!thread) {
    // Create new thread (F0544)
    const { data: newThread } = await supabase
      .from('sms_threads')
      .insert({
        contact_id: contact.id,
        from_number: to,
        status: 'active',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    thread = newThread
  }

  // Save inbound message
  await supabase.from('sms_messages').insert({
    thread_id: thread?.id,
    contact_id: contact.id,
    from_number: from,
    to_number: to,
    body,
    direction: 'inbound',
    status: 'received',
    twilio_sid: messageSid,
    created_at: timestamp || new Date().toISOString(),
  })

  // Check for opt-out keywords
  const optOutKeywords = ['stop', 'unsubscribe', 'cancel', 'end', 'quit']
  const normalizedBody = body.toLowerCase().trim()

  if (optOutKeywords.includes(normalizedBody)) {
    // Mark contact as opted out
    await supabase
      .from('contacts')
      .update({
        opted_out: true,
        opted_out_at: new Date().toISOString(),
      })
      .eq('id', contact.id)

    // Send confirmation
    const confirmMessage = 'You have been unsubscribed and will not receive further messages. Reply START to resubscribe.'
    await sendSMS({
      to: from,
      body: confirmMessage,
      from: to,
    })

    return {
      contactId: contact.id,
      threadId: thread?.id,
      autoReply: confirmMessage,
    }
  }

  // Check for opt-in keywords
  const optInKeywords = ['start', 'yes', 'subscribe']
  if (optInKeywords.includes(normalizedBody) && contact.opted_out) {
    // Re-opt in contact
    await supabase
      .from('contacts')
      .update({
        opted_out: false,
        opted_out_at: null,
      })
      .eq('id', contact.id)

    const welcomeMessage = 'Welcome back! You have been resubscribed and will receive messages again.'
    await sendSMS({
      to: from,
      body: welcomeMessage,
      from: to,
    })

    return {
      contactId: contact.id,
      threadId: thread?.id,
      autoReply: welcomeMessage,
    }
  }

  // Update thread last_message_at
  if (thread) {
    await supabase
      .from('sms_threads')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body.substring(0, 100),
      })
      .eq('id', thread.id)
  }

  return {
    contactId: contact.id,
    threadId: thread?.id,
  }
}

/**
 * F0543: Send reply in conversation thread
 */
export async function sendThreadReply(
  threadId: string,
  body: string
): Promise<{ success: boolean; messageId?: string }> {
  const supabase = supabaseAdmin

  // Get thread details
  const { data: thread, error } = await supabase
    .from('sms_threads')
    .select('*, contacts!inner(*)')
    .eq('id', threadId)
    .single()

  if (error || !thread) {
    throw new Error(`Thread ${threadId} not found`)
  }

  const contact = thread.contacts

  // Check if contact opted out
  if (contact.opted_out) {
    throw new Error('Cannot send to opted-out contact')
  }

  // Send SMS
  const result = await sendSMS({
    to: contact.phone,
    body,
    from: thread.from_number,
  })

  // Save outbound message
  const { data: message } = await supabase
    .from('sms_messages')
    .insert({
      thread_id: threadId,
      contact_id: contact.id,
      from_number: thread.from_number,
      to_number: contact.phone,
      body,
      direction: 'outbound',
      status: result.status === 'sent' ? 'sent' : 'failed',
      twilio_sid: result.sid,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  // Update thread
  await supabase
    .from('sms_threads')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: body.substring(0, 100),
    })
    .eq('id', threadId)

  return {
    success: result.status === 'sent',
    messageId: message?.id,
  }
}
