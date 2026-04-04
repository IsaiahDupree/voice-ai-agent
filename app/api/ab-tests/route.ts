// F0170: Greeting A/B test API endpoints
// F0232: Outbound script A/B test
// F0260: Campaign A/B persona test
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getABTestResults } from '@/lib/greeting-ab-test'
import {
  createABTest,
  assignVariant,
  getABTestResults as getCampaignABTestResults,
  pauseABTest,
  resumeABTest,
  endABTest,
  getWinningVariant,
} from '@/lib/ab-testing'
import { apiResponse } from '@/lib/api-response'

// Create a new A/B test
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // F0232/F0260: Campaign-level A/B testing (script or persona)
    if (body.campaign_id && (body.test_type === 'script' || body.test_type === 'persona')) {
      const { campaign_id, test_type, variants, traffic_split } = body

      if (!variants || variants.length < 2) {
        return apiResponse.error('At least 2 variants are required', 400)
      }

      const test = await createABTest(
        campaign_id,
        test_type,
        variants,
        traffic_split || 'equal'
      )

      return apiResponse.success({ test })
    }

    // F0170: Original greeting A/B test
    const { assistant_id, test_type, variant_a, variant_b, name, description } = body

    if (!assistant_id || !test_type || !variant_a || !variant_b) {
      return NextResponse.json(
        { error: 'Missing required fields: assistant_id, test_type, variant_a, variant_b OR campaign_id, test_type, variants' },
        { status: 400 }
      )
    }

    // Deactivate any existing active tests for this assistant/type
    await supabaseAdmin
      .from('voice_agent_ab_tests')
      .update({ status: 'paused' })
      .eq('assistant_id', assistant_id)
      .eq('test_type', test_type)
      .eq('status', 'active')

    // Create new test
    const { data, error } = await supabaseAdmin
      .from('voice_agent_ab_tests')
      .insert({
        assistant_id,
        test_type,
        variant_a,
        variant_b,
        name: name || `${test_type} A/B Test`,
        description,
        status: 'active',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, test: data })
  } catch (error: any) {
    console.error('Create A/B test error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// List all A/B tests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assistantId = searchParams.get('assistant_id')
    const status = searchParams.get('status')
    const testId = searchParams.get('test_id')

    // If requesting results for a specific test
    if (testId) {
      const results = await getABTestResults(testId)
      const { data: test } = await supabaseAdmin
        .from('voice_agent_ab_tests')
        .select('*')
        .eq('id', testId)
        .single()

      return NextResponse.json({
        test,
        results,
      })
    }

    // List tests
    let query = supabaseAdmin
      .from('voice_agent_ab_tests')
      .select('*')
      .order('created_at', { ascending: false })

    if (assistantId) {
      query = query.eq('assistant_id', assistantId)
    }
    if (status) {
      query = query.eq('status', status)
    }

    const { data: tests, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tests })
  } catch (error: any) {
    console.error('List A/B tests error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
