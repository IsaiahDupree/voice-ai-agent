// F1159: MFA support - Optional TOTP-based MFA for admin accounts
import { supabaseAdmin } from './supabase'
import * as crypto from 'crypto'

// Generate TOTP secret for new MFA enrollment
export function generateTOTPSecret(): string {
  // Generate base32-encoded secret
  const secret = crypto.randomBytes(20).toString('base64')
    .replace(/\+/g, '').replace(/\//g, '').replace(/=/g, '')
    .substring(0, 32)
  return secret
}

// Verify TOTP token
export function verifyTOTP(secret: string, token: string): boolean {
  // Simple time-based OTP verification
  // In production, use a library like otplib or speakeasy
  const window = 1 // Allow 1 step before/after for clock drift
  const timeStep = 30 // 30 second intervals
  const currentTime = Math.floor(Date.now() / 1000 / timeStep)

  for (let i = -window; i <= window; i++) {
    const expectedToken = generateTOTPToken(secret, currentTime + i)
    if (token === expectedToken) {
      return true
    }
  }

  return false
}

function generateTOTPToken(secret: string, counter: number): string {
  // Simplified TOTP generation
  // In production, use proper TOTP library
  const hmac = crypto.createHmac('sha1', secret)
  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(counter, 4)
  hmac.update(buffer)
  const hash = hmac.digest()

  const offset = hash[hash.length - 1] & 0xf
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)

  const otp = binary % 1000000
  return otp.toString().padStart(6, '0')
}

// Enroll user in MFA
export async function enrollMFA(userId: string): Promise<{
  secret: string
  qr_code_url: string
  backup_codes: string[]
}> {
  try {
    const secret = generateTOTPSecret()
    const backupCodes = generateBackupCodes()

    // Store MFA config
    await supabaseAdmin
      .from('voice_agent_users')
      .update({
        mfa_secret: secret,
        mfa_enabled: false, // Not enabled until verified
        mfa_backup_codes: backupCodes,
        mfa_enrolled_at: new Date().toISOString(),
      })
      .eq('id', userId)

    // Generate QR code URL for authenticator apps
    const appName = 'VoiceAIAgent'
    const qrCodeUrl = `otpauth://totp/${appName}:${userId}?secret=${secret}&issuer=${appName}`

    return {
      secret,
      qr_code_url: qrCodeUrl,
      backup_codes: backupCodes,
    }
  } catch (error: any) {
    console.error('MFA enrollment error:', error)
    throw error
  }
}

// Verify and enable MFA
export async function verifyAndEnableMFA(userId: string, token: string): Promise<boolean> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('voice_agent_users')
      .select('mfa_secret')
      .eq('id', userId)
      .single()

    if (error || !user || !user.mfa_secret) {
      throw new Error('User not enrolled in MFA')
    }

    if (!verifyTOTP(user.mfa_secret, token)) {
      return false
    }

    // Enable MFA
    await supabaseAdmin
      .from('voice_agent_users')
      .update({
        mfa_enabled: true,
        mfa_verified_at: new Date().toISOString(),
      })
      .eq('id', userId)

    console.log(`MFA enabled for user ${userId}`)
    return true
  } catch (error: any) {
    console.error('MFA verification error:', error)
    throw error
  }
}

// Verify MFA token during login
export async function verifyMFALogin(userId: string, token: string): Promise<boolean> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('voice_agent_users')
      .select('mfa_secret, mfa_enabled, mfa_backup_codes')
      .eq('id', userId)
      .single()

    if (error || !user || !user.mfa_enabled || !user.mfa_secret) {
      return false
    }

    // Check TOTP token
    if (verifyTOTP(user.mfa_secret, token)) {
      return true
    }

    // Check backup codes
    if (user.mfa_backup_codes && user.mfa_backup_codes.includes(token)) {
      // Remove used backup code
      const updatedCodes = user.mfa_backup_codes.filter((code: string) => code !== token)
      await supabaseAdmin
        .from('voice_agent_users')
        .update({ mfa_backup_codes: updatedCodes })
        .eq('id', userId)

      console.log(`User ${userId} used backup code for MFA`)
      return true
    }

    return false
  } catch (error: any) {
    console.error('MFA login verification error:', error)
    return false
  }
}

function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex')
    codes.push(code)
  }
  return codes
}
