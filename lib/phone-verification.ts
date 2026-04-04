// F1142: Phone number verification - Verify phone number ownership before SMS send

import { supabaseAdmin } from './supabase'
import crypto from 'crypto'

/**
 * Generate a verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Send verification code via SMS
 * This would integrate with Twilio or similar SMS provider
 */
export async function sendVerificationCode(
  phoneNumber: string
): Promise<{ success: boolean; error?: string; codeId?: string }> {
  try {
    const code = generateVerificationCode()

    // Store verification code temporarily
    const { data, error } = await supabaseAdmin
      .from('voice_agent_phone_verifications')
      .insert({
        phone_number: phoneNumber,
        verification_code: code,
        verified: false,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min expiry
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      throw error
    }

    // TODO: Send SMS via Twilio or similar provider
    // await sendSMS(phoneNumber, `Your verification code is: ${code}`)

    console.log(`[Phone Verification] Code sent to ${phoneNumber}:`, code)

    return {
      success: true,
      codeId: data?.id,
    }
  } catch (error: any) {
    console.error('Error sending verification code:', error)
    return {
      success: false,
      error: error.message || 'Failed to send verification code',
    }
  }
}

/**
 * F1142: Verify phone number ownership
 * Check if verification code matches
 */
export async function verifyPhoneNumber(
  phoneNumber: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date()

    // Check for valid code
    const { data: verification, error: lookupError } = await supabaseAdmin
      .from('voice_agent_phone_verifications')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('verification_code', code)
      .eq('verified', false)
      .gt('expires_at', now.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lookupError || !verification) {
      console.warn(`[Phone Verification] Invalid code for ${phoneNumber}`)
      return {
        success: false,
        error: 'Invalid or expired verification code',
      }
    }

    // Mark as verified
    const { error: updateError } = await supabaseAdmin
      .from('voice_agent_phone_verifications')
      .update({ verified: true, verified_at: now.toISOString() })
      .eq('id', verification.id)

    if (updateError) {
      throw updateError
    }

    console.log(`[Phone Verification] Phone ${phoneNumber} verified`)

    return { success: true }
  } catch (error: any) {
    console.error('Error verifying phone number:', error)
    return {
      success: false,
      error: error.message || 'Failed to verify phone number',
    }
  }
}

/**
 * Check if phone number is verified
 */
export async function isPhoneNumberVerified(
  phoneNumber: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_phone_verifications')
      .select('id')
      .eq('phone_number', phoneNumber)
      .eq('verified', true)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return !!data
  } catch (error) {
    console.error('Error checking phone verification:', error)
    return false
  }
}

/**
 * Require phone verification before action
 * Used as middleware check
 */
export async function requirePhoneVerification(
  phoneNumber: string
): Promise<{ verified: boolean; error?: string }> {
  const verified = await isPhoneNumberVerified(phoneNumber)

  if (!verified) {
    return {
      verified: false,
      error: 'Phone number must be verified before this action',
    }
  }

  return { verified: true }
}
