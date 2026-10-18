import { sendSMS } from '../sms'
import type { SMSProvider, SendSMSInput, SendSMSResult, ProviderHealth } from './types'

export class TwilioSMS implements SMSProvider {
  readonly slug = 'twilio'

  async send(input: SendSMSInput): Promise<SendSMSResult> {
    const res = await sendSMS({
      to: input.to,
      body: input.body,
      from: input.from,
      mediaUrl: input.mediaUrl,
    } as any)
    return {
      id: (res as any)?.sid ?? '',
      status: (res as any)?.status ?? 'queued',
      raw: res,
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const tok = process.env.TWILIO_AUTH_TOKEN
    if (!sid || !tok) return { healthy: false, message: 'Twilio credentials missing' }
    return { healthy: true }
  }
}
