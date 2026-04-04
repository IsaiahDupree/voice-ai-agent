// F1236: Twilio SMS event fixture

/**
 * F1236: Twilio SMS webhook - incoming message
 */
export const twilioIncomingSMS = {
  MessageSid: 'SM' + '0'.repeat(32),
  AccountSid: 'AC' + '0'.repeat(32),
  MessagingServiceSid: 'MG' + '0'.repeat(32),
  From: '+15555551234',
  To: '+15555556789',
  Body: 'STOP',
  NumMedia: '0',
  FromCity: 'NEW YORK',
  FromState: 'NY',
  FromZip: '10001',
  FromCountry: 'US',
  ToCity: '',
  ToState: '',
  ToZip: '',
  ToCountry: 'US',
  SmsStatus: 'received',
  SmsSid: 'SM' + '0'.repeat(32),
  ApiVersion: '2010-04-01',
}

/**
 * Twilio SMS webhook - outbound message status
 */
export const twilioSMSStatusDelivered = {
  MessageSid: 'SM' + '1'.repeat(32),
  AccountSid: 'AC' + '0'.repeat(32),
  To: '+15555551234',
  From: '+15555556789',
  MessageStatus: 'delivered',
  ApiVersion: '2010-04-01',
}

export const twilioSMSStatusFailed = {
  MessageSid: 'SM' + '1'.repeat(32),
  AccountSid: 'AC' + '0'.repeat(32),
  To: '+15555551234',
  From: '+15555556789',
  MessageStatus: 'failed',
  ErrorCode: '30007',
  ApiVersion: '2010-04-01',
}

/**
 * Twilio SMS opt-out keywords
 */
export const twilioSMSOptOut = {
  ...twilioIncomingSMS,
  MessageSid: 'SM' + '2'.repeat(32),
  Body: 'STOP',
}

export const twilioSMSOptOutUnsubscribe = {
  ...twilioIncomingSMS,
  MessageSid: 'SM' + '3'.repeat(32),
  Body: 'UNSUBSCRIBE',
}

export const twilioSMSOptIn = {
  ...twilioIncomingSMS,
  MessageSid: 'SM' + '4'.repeat(32),
  Body: 'START',
}
