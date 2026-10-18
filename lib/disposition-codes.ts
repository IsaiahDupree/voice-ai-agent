/**
 * F1410: Outbound disposition codes.
 *
 * Standard call-outcome codes applied to call records by agents and the
 * dialer. Codes are categorized so analytics can group them (contact vs
 * no-contact vs disqualified).
 */

import { supabaseAdmin } from './supabase'

export type DispositionCategory = 'contacted' | 'no_contact' | 'disqualified' | 'callback' | 'system'

export interface DispositionCode {
  code: string
  label: string
  category: DispositionCategory
  /** Should the dialer retry this contact later? */
  retryable: boolean
  /** Does this code count toward conversion metrics? */
  countsAsContact: boolean
}

export const DISPOSITION_CODES: DispositionCode[] = [
  // contacted
  { code: 'BOOKED', label: 'Appointment booked', category: 'contacted', retryable: false, countsAsContact: true },
  { code: 'INTERESTED', label: 'Interested — follow up', category: 'contacted', retryable: false, countsAsContact: true },
  { code: 'NOT_INTERESTED', label: 'Not interested', category: 'contacted', retryable: false, countsAsContact: true },
  { code: 'WRONG_PERSON', label: 'Reached wrong person', category: 'contacted', retryable: true, countsAsContact: false },
  { code: 'GATEKEEPER', label: 'Gatekeeper only', category: 'contacted', retryable: true, countsAsContact: false },
  { code: 'TRANSFERRED', label: 'Transferred to human', category: 'contacted', retryable: false, countsAsContact: true },

  // no_contact
  { code: 'NO_ANSWER', label: 'No answer', category: 'no_contact', retryable: true, countsAsContact: false },
  { code: 'BUSY', label: 'Line busy', category: 'no_contact', retryable: true, countsAsContact: false },
  { code: 'VOICEMAIL', label: 'Voicemail left', category: 'no_contact', retryable: true, countsAsContact: false },
  { code: 'VOICEMAIL_NO_DROP', label: 'Voicemail — no drop', category: 'no_contact', retryable: true, countsAsContact: false },
  { code: 'CALL_DROPPED', label: 'Call dropped', category: 'no_contact', retryable: true, countsAsContact: false },

  // disqualified — do not retry
  { code: 'DNC', label: 'Do not call (caller request)', category: 'disqualified', retryable: false, countsAsContact: true },
  { code: 'WRONG_NUMBER', label: 'Wrong number', category: 'disqualified', retryable: false, countsAsContact: false },
  { code: 'DISCONNECTED', label: 'Number disconnected', category: 'disqualified', retryable: false, countsAsContact: false },
  { code: 'OUT_OF_AREA', label: 'Out of service area', category: 'disqualified', retryable: false, countsAsContact: true },

  // callback
  { code: 'CALLBACK_REQUESTED', label: 'Callback requested', category: 'callback', retryable: true, countsAsContact: true },

  // system
  { code: 'FAILED', label: 'Call failed (system)', category: 'system', retryable: true, countsAsContact: false },
  { code: 'BLOCKED', label: 'Blocklisted number', category: 'system', retryable: false, countsAsContact: false },
]

const CODE_INDEX = new Map(DISPOSITION_CODES.map(d => [d.code, d]))

export function getDisposition(code: string): DispositionCode | undefined {
  return CODE_INDEX.get(code.toUpperCase())
}

export function isValidDisposition(code: string): boolean {
  return CODE_INDEX.has(code.toUpperCase())
}

export function isRetryable(code: string): boolean {
  return CODE_INDEX.get(code.toUpperCase())?.retryable ?? false
}

export interface ApplyDispositionInput {
  callId: string
  code: string
  notes?: string
  setBy?: string
}

export async function applyDisposition(input: ApplyDispositionInput): Promise<void> {
  const code = input.code.toUpperCase()
  const disposition = CODE_INDEX.get(code)
  if (!disposition) throw new Error(`Unknown disposition code: ${code}`)

  const { error } = await supabaseAdmin
    .from('voice_agent_calls')
    .update({
      disposition_code: code,
      disposition_category: disposition.category,
      disposition_notes: input.notes ?? null,
      disposition_set_by: input.setBy ?? 'system',
      disposition_set_at: new Date().toISOString(),
    })
    .eq('id', input.callId)

  if (error) throw new Error(`Failed to set disposition: ${error.message}`)
}
