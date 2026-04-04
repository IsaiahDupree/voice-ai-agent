// F0372: sendSMS template
// Pre-defined SMS templates for common scenarios

export interface SMSTemplate {
  name: string
  subject: string
  template: string
  variables: string[]
}

// F0372: Built-in SMS templates
export const smsTemplates: Record<string, SMSTemplate> = {
  booking_confirmation: {
    name: 'booking_confirmation',
    subject: 'Booking Confirmed',
    template: 'Hi {{name}}! Your {{event_type}} is confirmed for {{date}} at {{time}}. We look forward to seeing you!',
    variables: ['name', 'event_type', 'date', 'time'],
  },

  booking_reminder: {
    name: 'booking_reminder',
    subject: 'Appointment Reminder',
    template: 'Hi {{name}}, this is a reminder about your {{event_type}} tomorrow at {{time}}. See you then!',
    variables: ['name', 'event_type', 'time'],
  },

  // F0515: 24-hour appointment reminder
  booking_reminder_24h: {
    name: 'booking_reminder_24h',
    subject: '24h Reminder',
    template: 'Hi {{name}}! Reminder: Your {{event_type}} is in 24 hours on {{date}} at {{time}}. Reply CONFIRM or call {{phone}} if you need to reschedule.',
    variables: ['name', 'event_type', 'date', 'time', 'phone'],
  },

  booking_cancelled: {
    name: 'booking_cancelled',
    subject: 'Booking Cancelled',
    template: 'Hi {{name}}, your {{event_type}} scheduled for {{date}} has been cancelled. Reply to reschedule.',
    variables: ['name', 'event_type', 'date'],
  },

  // F0516: Booking cancellation template
  appointment_cancelled: {
    name: 'appointment_cancelled',
    subject: 'Appointment Cancelled',
    template: 'Your appointment on {{date}} at {{time}} has been cancelled. We apologize for any inconvenience. Reply RESCHEDULE to book a new time or call {{phone}}.',
    variables: ['date', 'time', 'phone'],
  },

  follow_up: {
    name: 'follow_up',
    subject: 'Follow Up',
    template: 'Hi {{name}}, thanks for talking with us today. {{message}}',
    variables: ['name', 'message'],
  },

  missed_call: {
    name: 'missed_call',
    subject: 'Missed Call',
    template: 'Hi {{name}}, we tried calling you. Please call us back at {{phone}} or book a time here: {{booking_link}}',
    variables: ['name', 'phone', 'booking_link'],
  },
}

export function renderSMSTemplate(
  templateName: string,
  variables: Record<string, string>
): string {
  const template = smsTemplates[templateName]
  if (!template) {
    throw new Error(`SMS template '${templateName}' not found`)
  }

  let message = template.template
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`
    message = message.replace(new RegExp(placeholder, 'g'), value)
  }

  return message
}

/**
 * Check if message body contains opt-out keywords
 */
export function isOptOutMessage(body: string): boolean {
  const optOutKeywords = ['stop', 'unsubscribe', 'cancel', 'end', 'quit', 'optout']
  const normalized = body.toLowerCase().trim()
  return optOutKeywords.includes(normalized)
}
