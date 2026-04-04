// F0244: Cold list validation
// Validate contact list against known bad numbers

import { supabaseAdmin } from './supabase'

export interface ValidationResult {
  phone: string
  is_valid: boolean
  reason?: string // disconnected/invalid/spam/carrier-block
}

/**
 * F0244: Validate a phone number
 * Checks against invalid_numbers and DNC lists
 */
export async function validatePhoneNumber(phone: string): Promise<ValidationResult> {
  try {
    // Check if number is in invalid_numbers table
    const { data: invalid } = await supabaseAdmin
      .from('voice_agent_invalid_numbers')
      .select('reason')
      .eq('phone', phone)
      .maybeSingle()

    if (invalid) {
      return {
        phone,
        is_valid: false,
        reason: invalid.reason,
      }
    }

    // Check DNC list
    const { data: dnc } = await supabaseAdmin
      .from('voice_agent_dnc_list')
      .select('phone')
      .eq('phone', phone)
      .maybeSingle()

    if (dnc) {
      return {
        phone,
        is_valid: false,
        reason: 'on_dnc_list',
      }
    }

    // Basic phone number format validation (E.164)
    const e164Pattern = /^\+[1-9]\d{1,14}$/
    if (!e164Pattern.test(phone)) {
      return {
        phone,
        is_valid: false,
        reason: 'invalid_format',
      }
    }

    return {
      phone,
      is_valid: true,
    }
  } catch (error) {
    console.error('Error validating phone:', error)
    // On error, assume valid (fail open for better UX)
    return {
      phone,
      is_valid: true,
    }
  }
}

/**
 * F0244: Validate list of contacts
 * Returns array of validation results
 */
export async function validateContactList(
  phones: string[]
): Promise<{ valid: string[]; invalid: ValidationResult[] }> {
  const results = await Promise.all(phones.map(validatePhoneNumber))

  const valid = results.filter((r) => r.is_valid).map((r) => r.phone)
  const invalid = results.filter((r) => !r.is_valid)

  console.log(`List validation: ${valid.length} valid, ${invalid.length} invalid`)

  return { valid, invalid }
}

/**
 * F0244: Mark a number as invalid
 * Called when a call fails with specific carrier errors
 */
export async function markNumberInvalid(
  phone: string,
  reason: string,
  source: string = 'vapi'
): Promise<void> {
  try {
    await supabaseAdmin.from('voice_agent_invalid_numbers').upsert(
      {
        phone,
        reason,
        detected_at: new Date().toISOString(),
        validation_source: source,
      },
      { onConflict: 'phone' }
    )

    console.log(`Marked ${phone} as invalid: ${reason}`)
  } catch (error) {
    console.error('Error marking number invalid:', error)
    // Don't throw - this is best-effort tracking
  }
}
