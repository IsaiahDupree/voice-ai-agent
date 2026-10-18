/**
 * Per-tenant integration credentials vault.
 *
 * Each tenant_pack_install can carry encrypted credentials keyed by
 * provider slug. Providers read these via resolveCalendar(map, creds)
 * etc. so process.env-based secrets are only the dev fallback.
 *
 * Key management:
 *   PACK_CREDENTIALS_KEYS   — JSON: {"k1":"<32-byte base64>", "k2":"..."}
 *   PACK_CREDENTIALS_ACTIVE_KID — currently-active key id (defaults to first)
 *
 * Records persist the kid alongside the ciphertext so rotation can roll
 * forward without breaking older installs.
 */

import crypto from 'crypto'
import { supabaseAdmin } from '../supabase'

export type CredentialBag = Record<string, Record<string, string>>

interface KeyMaterial {
  kid: string
  key: Buffer
}

function loadKeys(): KeyMaterial[] {
  const raw = process.env.PACK_CREDENTIALS_KEYS
  if (!raw) {
    // Dev-only fallback: derive a deterministic key from a low-stakes env.
    // Production must always set PACK_CREDENTIALS_KEYS.
    if (process.env.NODE_ENV === 'production') return []
    const dev = crypto.createHash('sha256').update('voice-ai-agent-dev-key').digest()
    return [{ kid: 'dev', key: dev }]
  }
  try {
    const obj = JSON.parse(raw) as Record<string, string>
    return Object.entries(obj).map(([kid, b64]) => ({ kid, key: Buffer.from(b64, 'base64') }))
  } catch {
    return []
  }
}

function activeKey(): KeyMaterial | null {
  const keys = loadKeys()
  if (keys.length === 0) return null
  const wanted = process.env.PACK_CREDENTIALS_ACTIVE_KID
  if (wanted) {
    const found = keys.find(k => k.kid === wanted)
    if (found) return found
  }
  return keys[0]
}

function findKey(kid: string): KeyMaterial | null {
  return loadKeys().find(k => k.kid === kid) ?? null
}

export function seal(payload: CredentialBag): { enc: string; kid: string } | null {
  const k = activeKey()
  if (!k) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', k.key, iv)
  const pt = Buffer.from(JSON.stringify(payload), 'utf8')
  const ct = Buffer.concat([cipher.update(pt), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    enc: Buffer.concat([iv, tag, ct]).toString('base64'),
    kid: k.kid,
  }
}

export function open(enc: string, kid: string): CredentialBag | null {
  const k = findKey(kid)
  if (!k) return null
  try {
    const buf = Buffer.from(enc, 'base64')
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const ct = buf.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', k.key, iv)
    decipher.setAuthTag(tag)
    const pt = Buffer.concat([decipher.update(ct), decipher.final()])
    return JSON.parse(pt.toString('utf8')) as CredentialBag
  } catch {
    return null
  }
}

export async function loadCredentialsForInstall(installId: string): Promise<CredentialBag> {
  const { data } = await supabaseAdmin
    .from('tenant_pack_installs')
    .select('integration_credentials_enc, integration_credentials_kid')
    .eq('id', installId)
    .maybeSingle()
  if (!data) return {}
  const enc = (data as any).integration_credentials_enc as string | null
  const kid = (data as any).integration_credentials_kid as string | null
  if (!enc || !kid) return {}
  return open(enc, kid) ?? {}
}

export async function saveCredentialsForInstall(
  installId: string,
  payload: CredentialBag,
): Promise<{ saved: boolean; reason?: string }> {
  const sealed = seal(payload)
  if (!sealed) return { saved: false, reason: 'no encryption keys configured' }
  const { error } = await supabaseAdmin
    .from('tenant_pack_installs')
    .update({
      integration_credentials_enc: sealed.enc,
      integration_credentials_kid: sealed.kid,
      updated_at: new Date().toISOString(),
    })
    .eq('id', installId)
  if (error) return { saved: false, reason: error.message }
  return { saved: true }
}

/**
 * Convenience: get the credentials bag for a single provider slug.
 * Returns env-derived fallbacks so existing adapters keep working when
 * a tenant hasn't configured per-install credentials yet.
 */
export function envFallback(providerSlug: string): Record<string, string> {
  switch (providerSlug) {
    case 'cal_com':
      return {
        api_key: process.env.CALCOM_API_KEY ?? '',
        default_event_type_id: process.env.CALCOM_DEFAULT_EVENT_TYPE_ID ?? '',
      }
    case 'calendly':
      return {
        api_token: process.env.CALENDLY_API_TOKEN ?? '',
        default_event_type_uri: process.env.CALENDLY_DEFAULT_EVENT_TYPE_URI ?? '',
      }
    case 'booksy':
      return {
        api_key: process.env.BOOKSY_API_KEY ?? '',
        business_id: process.env.BOOKSY_BUSINESS_ID ?? '',
        default_service_id: process.env.BOOKSY_DEFAULT_SERVICE_ID ?? '',
      }
    case 'servicetitan':
      return {
        tenant_id: process.env.SERVICETITAN_TENANT_ID ?? '',
        app_key: process.env.SERVICETITAN_APP_KEY ?? '',
        oauth_token: process.env.SERVICETITAN_OAUTH_TOKEN ?? '',
      }
    case 'opentable':
      return {
        api_key: process.env.OPENTABLE_API_KEY ?? '',
        restaurant_id: process.env.OPENTABLE_RESTAURANT_ID ?? '',
      }
    case 'twilio':
      return {
        account_sid: process.env.TWILIO_ACCOUNT_SID ?? '',
        auth_token: process.env.TWILIO_AUTH_TOKEN ?? '',
        from_number: process.env.TWILIO_PHONE_NUMBER ?? '',
      }
    case 'anthropic':
      return { api_key: process.env.ANTHROPIC_API_KEY ?? '' }
    default:
      return {}
  }
}

export function resolveCredentials(
  providerSlug: string,
  bag: CredentialBag,
): Record<string, string> {
  const tenant = bag[providerSlug] ?? {}
  const fallback = envFallback(providerSlug)
  return { ...fallback, ...tenant } // tenant overrides fallback
}
