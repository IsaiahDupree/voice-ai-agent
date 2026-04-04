// F0170: Greeting A/B test - Rotate between two firstMessage variants
import { supabaseAdmin } from './supabase'

export interface ABTestVariant {
  id: string
  name: string
  greeting: string
  calls: number
  conversions: number
  conversion_rate: number
}

export async function selectGreetingVariant(
  assistantId: string
): Promise<{ variant: 'A' | 'B'; greeting: string; testId?: string }> {
  try {
    // Check if A/B test is configured for this assistant
    const { data: test, error } = await supabaseAdmin
      .from('voice_agent_ab_tests')
      .select('*')
      .eq('assistant_id', assistantId)
      .eq('test_type', 'greeting')
      .eq('status', 'active')
      .single()

    if (error || !test) {
      // No active A/B test, return default
      return { variant: 'A', greeting: '' }
    }

    // Simple 50/50 split
    const variant = Math.random() < 0.5 ? 'A' : 'B'
    const greeting = variant === 'A' ? test.variant_a : test.variant_b

    // Log variant selection
    await supabaseAdmin.from('voice_agent_ab_test_impressions').insert({
      test_id: test.id,
      variant,
      timestamp: new Date().toISOString(),
    })

    return { variant, greeting, testId: test.id }
  } catch (error: any) {
    console.error('Error selecting greeting variant:', error)
    return { variant: 'A', greeting: '' }
  }
}

export async function trackABTestConversion(
  testId: string,
  variant: 'A' | 'B',
  callId: string,
  converted: boolean
) {
  try {
    await supabaseAdmin.from('voice_agent_ab_test_results').insert({
      test_id: testId,
      variant,
      call_id: callId,
      converted,
      timestamp: new Date().toISOString(),
    })

    console.log(`A/B test conversion tracked: Test ${testId}, Variant ${variant}, Converted: ${converted}`)
  } catch (error: any) {
    console.error('Error tracking A/B test conversion:', error)
    // Don't throw - tracking is best-effort
  }
}

export async function getABTestResults(testId: string): Promise<{
  variant_a: ABTestVariant
  variant_b: ABTestVariant
  winner?: 'A' | 'B'
  confidence?: number
}> {
  try {
    const { data: results, error } = await supabaseAdmin
      .from('voice_agent_ab_test_results')
      .select('*')
      .eq('test_id', testId)

    if (error) throw error

    const variantA = results.filter((r) => r.variant === 'A')
    const variantB = results.filter((r) => r.variant === 'B')

    const aConversions = variantA.filter((r) => r.converted).length
    const bConversions = variantB.filter((r) => r.converted).length

    const aRate = variantA.length > 0 ? aConversions / variantA.length : 0
    const bRate = variantB.length > 0 ? bConversions / variantB.length : 0

    const statsA: ABTestVariant = {
      id: 'A',
      name: 'Variant A',
      greeting: '',
      calls: variantA.length,
      conversions: aConversions,
      conversion_rate: aRate,
    }

    const statsB: ABTestVariant = {
      id: 'B',
      name: 'Variant B',
      greeting: '',
      calls: variantB.length,
      conversions: bConversions,
      conversion_rate: bRate,
    }

    // Simple winner determination (needs more samples for statistical significance)
    let winner: 'A' | 'B' | undefined
    if (variantA.length >= 30 && variantB.length >= 30) {
      winner = aRate > bRate ? 'A' : 'B'
    }

    return {
      variant_a: statsA,
      variant_b: statsB,
      winner,
    }
  } catch (error: any) {
    console.error('Error getting A/B test results:', error)
    throw error
  }
}
