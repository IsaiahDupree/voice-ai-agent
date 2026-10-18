/**
 * Credentials vault — seal/open round-trip + tampering detection.
 */

const TEST_KEY = Buffer.alloc(32, 7).toString('base64')
process.env.PACK_CREDENTIALS_KEYS = JSON.stringify({ k1: TEST_KEY })
process.env.PACK_CREDENTIALS_ACTIVE_KID = 'k1'

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}))

import { seal, open, resolveCredentials, envFallback } from '@/lib/packs/credentials'

describe('credentials vault', () => {
  it('round-trips a payload', () => {
    const sealed = seal({
      cal_com: { api_key: 'secret-1', default_event_type_id: '999' },
    })
    expect(sealed).not.toBeNull()
    const opened = open(sealed!.enc, sealed!.kid)
    expect(opened?.cal_com?.api_key).toBe('secret-1')
    expect(opened?.cal_com?.default_event_type_id).toBe('999')
  })

  it('returns null on tampered ciphertext', () => {
    const sealed = seal({ cal_com: { api_key: 'secret-2' } })!
    const tampered = Buffer.from(sealed.enc, 'base64')
    tampered[40] ^= 0xff
    const opened = open(tampered.toString('base64'), sealed.kid)
    expect(opened).toBeNull()
  })

  it('returns null on unknown kid', () => {
    const sealed = seal({ cal_com: { api_key: 'secret-3' } })!
    expect(open(sealed.enc, 'no-such-kid')).toBeNull()
  })

  it('resolveCredentials prefers tenant values over env fallback', () => {
    process.env.CALCOM_API_KEY = 'env-key'
    const merged = resolveCredentials('cal_com', { cal_com: { api_key: 'tenant-key' } })
    expect(merged.api_key).toBe('tenant-key')
  })

  it('resolveCredentials falls back to env when tenant lacks the key', () => {
    process.env.CALCOM_API_KEY = 'env-only'
    const merged = resolveCredentials('cal_com', {})
    expect(merged.api_key).toBe('env-only')
  })

  it('envFallback returns empty for unknown providers', () => {
    expect(envFallback('not_a_real_provider')).toEqual({})
  })
})
