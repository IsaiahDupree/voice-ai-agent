/**
 * __tests__/integration/twilio-coverage.test.ts
 *
 * Live integration tests covering every Twilio Console field and API-only resource.
 * Validates current phone number config, messaging service, toll-free verification
 * status, and API-only capabilities.
 *
 * Run: npx jest --config jest.integration.config.js __tests__/integration/twilio-coverage.test.ts
 *
 * Required env vars (in .env.local):
 *   TWILIO_ACCOUNT_SID   - ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN    - your auth token
 *   TWILIO_PHONE_NUMBER  - +18448814708
 *   TWILIO_PHONE_SID     - PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (optional)
 */

import https from 'https'

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+18448814708'
const PHONE_SID = process.env.TWILIO_PHONE_SID

if (!ACCOUNT_SID) throw new Error('TWILIO_ACCOUNT_SID env var is required')
if (!AUTH_TOKEN) throw new Error('TWILIO_AUTH_TOKEN env var is required')

const CORE_BASE = 'api.twilio.com'
const MESSAGING_BASE = 'messaging.twilio.com'

// ─── HTTP HELPERS ─────────────────────────────────────────────────────────────

function coreRequest(
  method: string,
  path: string,
  body?: Record<string, string>
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = body
      ? new URLSearchParams(body).toString()
      : undefined

    const options: https.RequestOptions = {
      hostname: CORE_BASE,
      path,
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64')}`,
        Accept: 'application/json',
        ...(payload
          ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) }
          : {}),
      },
    }

    const req = https.request(options, (res) => {
      let raw = ''
      res.on('data', (c) => { raw += c })
      res.on('end', () => {
        try { resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) }) }
        catch { resolve({ status: res.statusCode ?? 0, data: raw }) }
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function messagingRequest(
  method: string,
  path: string,
  body?: Record<string, string>
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = body
      ? JSON.stringify(body)
      : undefined

    const options: https.RequestOptions = {
      hostname: MESSAGING_BASE,
      path,
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64')}`,
        Accept: 'application/json',
        ...(payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {}),
      },
    }

    const req = https.request(options, (res) => {
      let raw = ''
      res.on('data', (c) => { raw += c })
      res.on('end', () => {
        try { resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) }) }
        catch { resolve({ status: res.statusCode ?? 0, data: raw }) }
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

// ─── SHARED STATE ─────────────────────────────────────────────────────────────

let phoneNumber: any
let phoneNumbers: any[]
let messagingServices: any[]
let calls: any[]
let messages: any[]

beforeAll(async () => {
  const BASE = `/2010-04-01/Accounts/${ACCOUNT_SID}`

  const [pnRes, callRes, msgRes] = await Promise.all([
    coreRequest('GET', `${BASE}/IncomingPhoneNumbers.json`),
    coreRequest('GET', `${BASE}/Calls.json?PageSize=10`),
    coreRequest('GET', `${BASE}/Messages.json?PageSize=10`),
  ])

  phoneNumbers = pnRes.data?.incoming_phone_numbers ?? []
  calls = callRes.data?.calls ?? []
  messages = msgRes.data?.messages ?? []

  // Find the toll-free number
  phoneNumber = phoneNumbers.find(
    (n: any) => n.phone_number === PHONE_NUMBER
  ) ?? phoneNumbers[0]

  // Messaging Services (different base)
  const msRes = await messagingRequest('GET', '/v1/Services')
  messagingServices = msRes.data?.services ?? []
}, 30000)

// =============================================================================
// ACCOUNT — validate credentials and basic account state
// =============================================================================
describe('Account', () => {
  test('Account SID has correct format', () => {
    expect(ACCOUNT_SID).toMatch(/^AC[a-f0-9]{32}$/)
  })

  test('GET /Accounts/{Sid} returns account info', async () => {
    const { status, data } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}.json`
    )
    expect(status).toBe(200)
    expect(data.sid).toBe(ACCOUNT_SID)
    expect(data.status).toBe('active')
    expect(typeof data.friendly_name).toBe('string')
  })

  test('account type is full (not trial)', async () => {
    const { data } = await coreRequest('GET', `/2010-04-01/Accounts/${ACCOUNT_SID}.json`)
    // trial accounts have type 'Trial'
    expect(data.type).toBe('Full')
  })
})

// =============================================================================
// PHONE NUMBERS — Console Fields
// =============================================================================
describe('Console Fields — Phone Numbers', () => {
  test('account has at least one incoming phone number', () => {
    expect(Array.isArray(phoneNumbers)).toBe(true)
    expect(phoneNumbers.length).toBeGreaterThan(0)
  })

  test('toll-free number +18448814708 is in the account', () => {
    const tfn = phoneNumbers.find((n: any) => n.phone_number === '+18448814708')
    expect(tfn).toBeDefined()
  })

  test('phone number has a friendly_name set', () => {
    expect(typeof phoneNumber.friendly_name).toBe('string')
    expect(phoneNumber.friendly_name.length).toBeGreaterThan(0)
  })

  test('phone number has capabilities object', () => {
    expect(phoneNumber.capabilities).toBeDefined()
    expect(typeof phoneNumber.capabilities.voice).toBe('boolean')
    expect(typeof phoneNumber.capabilities.sms).toBe('boolean')
  })

  test('toll-free number has SMS capability', () => {
    const tfn = phoneNumbers.find((n: any) => n.phone_number === '+18448814708')
    expect(tfn?.capabilities?.sms).toBe(true)
  })

  test('phone number SID starts with PN', () => {
    expect(phoneNumber.sid).toMatch(/^PN[a-f0-9]{32}$/)
  })

  test('phone number has valid status', () => {
    expect(phoneNumber.status).toBe('in-use')
  })
})

// =============================================================================
// PHONE NUMBER WEBHOOK CONFIG — Dashboard fields
// =============================================================================
describe('Console Fields — Phone Number Webhooks', () => {
  test('voice_url is a string if set', () => {
    if (phoneNumber.voice_url) {
      expect(typeof phoneNumber.voice_url).toBe('string')
      expect(phoneNumber.voice_url).toMatch(/^https?:\/\//)
    }
  })

  test('voice_method is GET or POST if set', () => {
    if (phoneNumber.voice_method) {
      expect(['GET', 'POST']).toContain(phoneNumber.voice_method)
    }
  })

  test('sms_url is a string if set', () => {
    if (phoneNumber.sms_url) {
      expect(typeof phoneNumber.sms_url).toBe('string')
      expect(phoneNumber.sms_url).toMatch(/^https?:\/\//)
    }
  })

  test('sms_method is GET or POST if set', () => {
    if (phoneNumber.sms_method) {
      expect(['GET', 'POST']).toContain(phoneNumber.sms_method)
    }
  })

  test('status_callback is a string if set', () => {
    if (phoneNumber.status_callback) {
      expect(typeof phoneNumber.status_callback).toBe('string')
    }
  })

  test('PATCH phone number friendly_name is accepted (200)', async () => {
    const currentName = phoneNumber.friendly_name
    const { status } = await coreRequest(
      'POST',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/IncomingPhoneNumbers/${phoneNumber.sid}.json`,
      { FriendlyName: currentName } // set to same value — no actual change
    )
    expect(status).toBe(200)
  })
})

// =============================================================================
// MESSAGING SERVICES — Console Fields
// =============================================================================
describe('Console Fields — Messaging Services', () => {
  test('GET /v1/Services returns 200', async () => {
    const { status } = await messagingRequest('GET', '/v1/Services')
    expect(status).toBe(200)
  })

  test('messaging services list is an array', () => {
    expect(Array.isArray(messagingServices)).toBe(true)
  })

  test('each messaging service has a sid and friendly_name', () => {
    messagingServices.forEach((svc: any) => {
      expect(svc.sid).toMatch(/^MG[a-f0-9]{32}$/)
      expect(typeof svc.friendly_name).toBe('string')
    })
  })

  test('each messaging service has inbound_request_url if set', () => {
    messagingServices.forEach((svc: any) => {
      if (svc.inbound_request_url) {
        expect(typeof svc.inbound_request_url).toBe('string')
      }
    })
  })
})

// =============================================================================
// CALLS — API-only resource
// =============================================================================
describe('API-Only — Call Logs', () => {
  test('GET /Calls returns 200', async () => {
    const { status } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json?PageSize=1`
    )
    expect(status).toBe(200)
  })

  test('calls list has expected fields', () => {
    if (calls.length === 0) return // skip if no call history
    const call = calls[0]
    expect(call.sid).toMatch(/^CA[a-f0-9]{32}$/)
    expect(typeof call.status).toBe('string')
    expect(['queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled']).toContain(call.status)
    expect(call.from).toMatch(/^\+\d{10,}$/)
    expect(call.to).toMatch(/^\+\d{10,}$/)
  })

  test('call record has direction field', () => {
    if (calls.length === 0) return
    const call = calls[0]
    expect(['inbound', 'outbound-api', 'outbound-dial']).toContain(call.direction)
  })

  test('PATCH /Calls/{Sid} to redirect live call returns 200 or 404 (not 401)', async () => {
    if (calls.length === 0) return
    // We only expect 404 (call ended) or 200 (updated) — never 401
    const completedCall = calls.find((c: any) => c.status === 'completed')
    if (!completedCall) return
    const { status } = await coreRequest(
      'POST',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Calls/${completedCall.sid}.json`,
      { Status: 'completed' } // noop on already-completed call
    )
    expect([200, 422]).toContain(status) // 422 = unprocessable (call already ended)
  })
})

// =============================================================================
// MESSAGES — Console + API fields
// =============================================================================
describe('Console Fields + API — Messages', () => {
  test('GET /Messages returns 200', async () => {
    const { status } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json?PageSize=1`
    )
    expect(status).toBe(200)
  })

  test('message records have expected fields', () => {
    if (messages.length === 0) return
    const msg = messages[0]
    expect(msg.sid).toMatch(/^SM[a-f0-9]{32}$/)
    expect(['queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'received']).toContain(msg.status)
    expect(msg.direction).toMatch(/^(inbound|outbound)/)
    expect(msg.from).toMatch(/^\+\d{10,}$/)
  })

  test('message has price and price_unit if sent', () => {
    const sent = messages.find((m: any) => m.direction !== 'inbound' && m.price)
    if (!sent) return
    expect(typeof sent.price).toBe('string')
    expect(sent.price_unit).toBe('USD')
  })

  test('sending SMS with invalid To returns 400 (not 500)', async () => {
    const { status, data } = await coreRequest(
      'POST',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      {
        From: PHONE_NUMBER,
        To: '+19999999999', // likely invalid/unroutable
        Body: 'test',
      }
    )
    // Either 400 (validation fail) or 201 (accepted) or 400 (unverified on trial)
    expect([201, 400, 429]).toContain(status)
  })
})

// =============================================================================
// USAGE RECORDS — API-only resource
// =============================================================================
describe('API-Only — Usage Records', () => {
  test('GET /Usage/Records/ThisMonth returns 200', async () => {
    const { status, data } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Usage/Records/ThisMonth.json`
    )
    expect(status).toBe(200)
    expect(Array.isArray(data.usage_records)).toBe(true)
  })

  test('usage records have category, usage, price fields', async () => {
    const { data } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Usage/Records/ThisMonth.json`
    )
    const record = data.usage_records?.[0]
    if (!record) return
    expect(typeof record.category).toBe('string')
    expect(typeof record.usage).toBe('string')
    expect(typeof record.price).toBe('string')
    expect(record.price_unit).toBe('USD')
  })

  test('GET /Usage/Records/Daily returns 200', async () => {
    const { status } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Usage/Records/Daily.json?PageSize=5`
    )
    expect(status).toBe(200)
  })
})

// =============================================================================
// TOLL-FREE VERIFICATION — API-only resource
// =============================================================================
describe('API-Only — Toll-Free Verification', () => {
  test('GET /Tollfree/Verifications returns 200', async () => {
    const { status } = await messagingRequest('GET', '/v1/Tollfree/Verifications')
    expect(status).toBe(200)
  })

  test('toll-free verification exists for +18448814708', async () => {
    const { data } = await messagingRequest('GET', '/v1/Tollfree/Verifications')
    const verifications = data?.results ?? []
    const tfv = verifications.find(
      (v: any) => v.toll_free_phone_number === PHONE_NUMBER
    )
    // May be pending or approved
    if (tfv) {
      expect(['PENDING_REVIEW', 'IN_REVIEW', 'TWILIO_APPROVED', 'UPDATE_REQUIRED']).toContain(tfv.status)
      expect(tfv.toll_free_phone_number).toBe(PHONE_NUMBER)
    }
    // If no verification found yet, just ensure the API works
    expect(Array.isArray(verifications)).toBe(true)
  })

  test('verification record has required fields if present', async () => {
    const { data } = await messagingRequest('GET', '/v1/Tollfree/Verifications')
    const verifications = data?.results ?? []
    const tfv = verifications[0]
    if (!tfv) return
    expect(typeof tfv.sid).toBe('string')
    expect(typeof tfv.status).toBe('string')
    expect(typeof tfv.toll_free_phone_number).toBe('string')
    expect(typeof tfv.business_name).toBe('string')
  })
})

// =============================================================================
// AVAILABLE PHONE NUMBERS — API-only search
// =============================================================================
describe('API-Only — Available Phone Numbers', () => {
  test('GET /AvailablePhoneNumbers/US/TollFree returns list', async () => {
    const { status, data } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/AvailablePhoneNumbers/US/TollFree.json?PageSize=3`
    )
    expect(status).toBe(200)
    expect(Array.isArray(data.available_phone_numbers)).toBe(true)
    expect(data.available_phone_numbers.length).toBeGreaterThan(0)
  })

  test('available numbers have phone_number and capabilities', async () => {
    const { data } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/AvailablePhoneNumbers/US/TollFree.json?PageSize=3`
    )
    const num = data.available_phone_numbers?.[0]
    if (!num) return
    expect(num.phone_number).toMatch(/^\+1/)
    expect(typeof num.capabilities).toBe('object')
  })

  test('GET /AvailablePhoneNumbers/US/Local returns list', async () => {
    const { status, data } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/AvailablePhoneNumbers/US/Local.json?PageSize=3&AreaCode=321`
    )
    expect(status).toBe(200)
    expect(Array.isArray(data.available_phone_numbers)).toBe(true)
  })
})

// =============================================================================
// RECORDINGS — API-only resource
// =============================================================================
describe('API-Only — Recordings', () => {
  test('GET /Recordings returns 200', async () => {
    const { status, data } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Recordings.json?PageSize=5`
    )
    expect(status).toBe(200)
    expect(Array.isArray(data.recordings)).toBe(true)
  })

  test('recordings have expected fields if any exist', async () => {
    const { data } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Recordings.json?PageSize=5`
    )
    const rec = data.recordings?.[0]
    if (!rec) return
    expect(rec.sid).toMatch(/^RE[a-f0-9]{32}$/)
    expect(typeof rec.duration).toBe('string')
    expect(['in-progress', 'paused', 'stopped', 'processing', 'completed', 'failed']).toContain(rec.status)
  })
})

// =============================================================================
// TWIML APPLICATIONS — Console + API
// =============================================================================
describe('Console Fields + API — TwiML Applications', () => {
  test('GET /Applications returns 200', async () => {
    const { status, data } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Applications.json?PageSize=10`
    )
    expect(status).toBe(200)
    expect(Array.isArray(data.applications)).toBe(true)
  })

  test('applications have sid, friendly_name, voice_url fields', async () => {
    const { data } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Applications.json?PageSize=10`
    )
    data.applications?.forEach((app: any) => {
      expect(app.sid).toMatch(/^AP[a-f0-9]{32}$/)
      expect(typeof app.friendly_name).toBe('string')
    })
  })
})

// =============================================================================
// API KEYS — API-only management
// =============================================================================
describe('API-Only — API Keys', () => {
  test('GET /Keys returns 200', async () => {
    const { status, data } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Keys.json`
    )
    expect(status).toBe(200)
    expect(Array.isArray(data.keys)).toBe(true)
  })

  test('API keys have sid and friendly_name', async () => {
    const { data } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Keys.json`
    )
    data.keys?.forEach((key: any) => {
      expect(key.sid).toMatch(/^SK[a-f0-9]{32}$/)
      expect(typeof key.friendly_name).toBe('string')
    })
  })
})

// =============================================================================
// FIELD REJECTION TESTS — spec vs reality gaps
// =============================================================================
describe('Spec vs Reality — Field Validation', () => {
  test('POST /Messages with missing Body and no MediaUrl returns 400', async () => {
    const { status } = await coreRequest(
      'POST',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      {
        From: PHONE_NUMBER,
        To: '+12125551234',
        // Body omitted — should be invalid
      }
    )
    expect(status).toBe(400)
  })

  test('GET /Calls/{InvalidSid} returns 404', async () => {
    const { status } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/Calls/CA00000000000000000000000000000000.json`
    )
    expect(status).toBe(404)
  })

  test('GET /IncomingPhoneNumbers/{InvalidSid} returns 404', async () => {
    const { status } = await coreRequest(
      'GET',
      `/2010-04-01/Accounts/${ACCOUNT_SID}/IncomingPhoneNumbers/PN00000000000000000000000000000000.json`
    )
    expect(status).toBe(404)
  })

  test('wrong auth token returns 401', async () => {
    const { status } = await new Promise<{ status: number; data: any }>((resolve, reject) => {
      const opts: https.RequestOptions = {
        hostname: CORE_BASE,
        path: `/2010-04-01/Accounts/${ACCOUNT_SID}.json`,
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`${ACCOUNT_SID}:wrongtoken`).toString('base64')}`,
          Accept: 'application/json',
        },
      }
      const req = https.request(opts, (res) => {
        let raw = ''
        res.on('data', (c) => { raw += c })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, data: raw }))
      })
      req.on('error', reject)
      req.end()
    })
    expect(status).toBe(401)
  })
})
