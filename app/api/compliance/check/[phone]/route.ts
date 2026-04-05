import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { formatE164, validatePhoneNumber } from '@/lib/sms'

interface ComplianceResult {
  allowed: boolean
  reason: string
  checks: Record<string, { passed: boolean; detail: string }>
}

export async function POST(
  request: NextRequest,
  { params }: { params: { phone: string } }
) {
  try {
    const rawPhone = decodeURIComponent(params.phone)
    const phone = formatE164(rawPhone)

    if (!validatePhoneNumber(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    const checks: Record<string, { passed: boolean; detail: string }> = {}

    // 1. Check suppression list
    const { data: suppressed } = await supabaseAdmin
      .from('localreach_suppression_list')
      .select('id, reason, added_at')
      .eq('phone', phone)
      .single()

    checks.suppression = suppressed
      ? { passed: false, detail: `On suppression list since ${suppressed.added_at}: ${suppressed.reason || 'no reason'}` }
      : { passed: true, detail: 'Not on suppression list' }

    // 2. Check DNC / Do Not Call registry
    const { data: dnc } = await supabaseAdmin
      .from('voice_agent_dnc')
      .select('id')
      .eq('phone_number', phone)
      .single()

    checks.dnc = dnc
      ? { passed: false, detail: 'On Do Not Call registry' }
      : { passed: true, detail: 'Not on DNC list' }

    // 3. Check SMS opt-out
    const { data: smsOptOut } = await supabaseAdmin
      .from('voice_agent_sms_opt_outs')
      .select('id')
      .eq('phone_number', phone)
      .single()

    checks.smsOptOut = smsOptOut
      ? { passed: false, detail: 'Phone has opted out of SMS' }
      : { passed: true, detail: 'No SMS opt-out' }

    // 4. Check blocklist
    const { data: blocked } = await supabaseAdmin
      .from('voice_agent_blocklist')
      .select('id')
      .eq('phone_number', phone)
      .single()

    checks.blocklist = blocked
      ? { passed: false, detail: 'Phone is on the blocklist' }
      : { passed: true, detail: 'Not on blocklist' }

    // 5. Check recent call frequency (TCPA: max 3 calls in 30 days without consent)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { count: recentCallCount } = await supabaseAdmin
      .from('localreach_call_log')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('called_at', thirtyDaysAgo)

    const callCount = recentCallCount || 0
    checks.callFrequency = callCount >= 3
      ? { passed: false, detail: `${callCount} calls in last 30 days (TCPA limit: 3)` }
      : { passed: true, detail: `${callCount}/3 calls in last 30 days` }

    // 6. Check calling hours (TCPA: no calls before 8am or after 9pm local time)
    const now = new Date()
    const hour = now.getHours()
    checks.callingHours = hour < 8 || hour >= 21
      ? { passed: false, detail: `Current hour ${hour}:00 is outside TCPA calling hours (8am-9pm)` }
      : { passed: true, detail: `Current hour ${hour}:00 is within calling hours` }

    // Determine overall compliance
    const allPassed = Object.values(checks).every(c => c.passed)
    const failedChecks = Object.entries(checks)
      .filter(([, c]) => !c.passed)
      .map(([name, c]) => `${name}: ${c.detail}`)

    const result: ComplianceResult = {
      allowed: allPassed,
      reason: allPassed
        ? 'All compliance checks passed'
        : `Blocked: ${failedChecks.join('; ')}`,
      checks,
    }

    // Log the compliance check
    await supabaseAdmin.from('localreach_compliance_log').insert({
      phone,
      allowed: allPassed,
      reason: result.reason,
      checks_detail: checks,
      checked_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      phone,
      compliance: result,
    })
  } catch (error: any) {
    console.error('[Compliance Check API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check compliance' },
      { status: 500 }
    )
  }
}
