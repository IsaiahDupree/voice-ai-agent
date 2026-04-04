// F0232: Outbound script A/B test
// F0260: Campaign A/B persona test

import { supabase } from './supabase'

export type ABTestType = 'script' | 'persona'

export interface ABTestVariant {
  id: string
  name: string
  weight: number // 0-100, total should equal 100
  config: any // Script text or persona config
}

export interface ABTest {
  id: string
  campaign_id: string
  test_type: ABTestType
  variants: ABTestVariant[]
  traffic_split: 'equal' | 'weighted' // Equal 50/50 or weighted distribution
  started_at: string
  ended_at?: string
  status: 'active' | 'paused' | 'completed'
}

export interface ABTestAssignment {
  contact_id: string
  test_id: string
  variant_id: string
  assigned_at: string
}

export interface ABTestResults {
  test_id: string
  variants: Array<{
    variant_id: string
    variant_name: string
    total_calls: number
    successful_calls: number
    bookings: number
    avg_duration_seconds: number
    conversion_rate: number
  }>
}

/**
 * F0232/F0260: Create A/B test for campaign
 *
 * @param campaignId Campaign to run test on
 * @param testType Type of test (script or persona)
 * @param variants Array of variants to test
 * @param trafficSplit Equal or weighted distribution
 */
export async function createABTest(
  campaignId: string,
  testType: ABTestType,
  variants: ABTestVariant[],
  trafficSplit: 'equal' | 'weighted' = 'equal'
): Promise<ABTest> {
  // Validation
  if (variants.length < 2) {
    throw new Error('A/B test requires at least 2 variants')
  }

  if (variants.length > 5) {
    throw new Error('Maximum 5 variants allowed')
  }

  // Validate weights if weighted split
  if (trafficSplit === 'weighted') {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0)
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error('Variant weights must sum to 100')
    }
  }

  const testId = `ab_${Date.now()}_${Math.random().toString(36).substring(7)}`

  const test: ABTest = {
    id: testId,
    campaign_id: campaignId,
    test_type: testType,
    variants,
    traffic_split: trafficSplit,
    started_at: new Date().toISOString(),
    status: 'active',
  }

  // Store test in database
  const { error } = await supabase.from('ab_tests').insert({
    id: test.id,
    campaign_id: test.campaign_id,
    test_type: test.test_type,
    variants: test.variants,
    traffic_split: test.traffic_split,
    started_at: test.started_at,
    status: test.status,
  })

  if (error) {
    console.error('Error creating A/B test:', error)
    throw new Error('Failed to create A/B test')
  }

  console.log(
    `✓ Created ${testType} A/B test for campaign ${campaignId} with ${variants.length} variants`
  )

  return test
}

/**
 * F0232/F0260: Assign contact to variant
 *
 * Uses consistent hashing to ensure same contact always gets same variant
 * (unless test config changes)
 *
 * @param testId A/B test ID
 * @param contactId Contact ID to assign
 * @returns Assigned variant
 */
export async function assignVariant(
  testId: string,
  contactId: string
): Promise<ABTestVariant> {
  // Check if already assigned
  const { data: existing } = await supabase
    .from('ab_test_assignments')
    .select('variant_id, ab_tests(variants)')
    .eq('test_id', testId)
    .eq('contact_id', contactId)
    .single()

  if (existing) {
    const test = existing.ab_tests as any
    const variant = test.variants.find(
      (v: ABTestVariant) => v.id === existing.variant_id
    )
    if (variant) {
      return variant
    }
  }

  // Get test config
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('*')
    .eq('id', testId)
    .single()

  if (testError || !test) {
    throw new Error('A/B test not found')
  }

  if (test.status !== 'active') {
    throw new Error('A/B test is not active')
  }

  const variants = test.variants as ABTestVariant[]

  // Select variant based on traffic split
  let selectedVariant: ABTestVariant

  if (test.traffic_split === 'equal') {
    // Equal split - use consistent hashing
    const hash = simpleHash(contactId + testId)
    const index = hash % variants.length
    selectedVariant = variants[index]
  } else {
    // Weighted split - use weighted random selection with consistent seed
    const seed = simpleHash(contactId + testId)
    selectedVariant = weightedRandomSelect(variants, seed)
  }

  // Store assignment
  await supabase.from('ab_test_assignments').insert({
    test_id: testId,
    contact_id: contactId,
    variant_id: selectedVariant.id,
    assigned_at: new Date().toISOString(),
  })

  console.log(
    `Assigned contact ${contactId} to variant ${selectedVariant.name} in test ${testId}`
  )

  return selectedVariant
}

/**
 * Simple hash function for consistent variant assignment
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Weighted random selection with consistent seed
 */
function weightedRandomSelect(
  variants: ABTestVariant[],
  seed: number
): ABTestVariant {
  // Use seed to generate deterministic "random" value
  const random = (seed % 100) / 100

  let cumulativeWeight = 0
  for (const variant of variants) {
    cumulativeWeight += variant.weight / 100
    if (random < cumulativeWeight) {
      return variant
    }
  }

  // Fallback to last variant
  return variants[variants.length - 1]
}

/**
 * Get A/B test results with statistics
 */
export async function getABTestResults(testId: string): Promise<ABTestResults> {
  // Get test config
  const { data: test } = await supabase
    .from('ab_tests')
    .select('*')
    .eq('id', testId)
    .single()

  if (!test) {
    throw new Error('A/B test not found')
  }

  const variants = test.variants as ABTestVariant[]

  // Get call results for each variant
  const variantResults = await Promise.all(
    variants.map(async (variant) => {
      // Get calls for this variant
      const { data: calls } = await supabase
        .from('calls')
        .select('status, duration, booking_created')
        .eq('campaign_id', test.campaign_id)
        .eq('ab_test_variant_id', variant.id)

      const totalCalls = calls?.length || 0
      const successfulCalls =
        calls?.filter((c) => c.status === 'completed').length || 0
      const bookings = calls?.filter((c) => c.booking_created).length || 0
      const avgDuration =
        calls && calls.length > 0
          ? calls.reduce((sum, c) => sum + (c.duration || 0), 0) / calls.length
          : 0

      return {
        variant_id: variant.id,
        variant_name: variant.name,
        total_calls: totalCalls,
        successful_calls: successfulCalls,
        bookings,
        avg_duration_seconds: Math.round(avgDuration),
        conversion_rate:
          totalCalls > 0 ? Math.round((bookings / totalCalls) * 100) : 0,
      }
    })
  )

  return {
    test_id: testId,
    variants: variantResults,
  }
}

/**
 * Pause A/B test
 */
export async function pauseABTest(testId: string): Promise<void> {
  await supabase
    .from('ab_tests')
    .update({ status: 'paused' })
    .eq('id', testId)

  console.log(`✓ Paused A/B test ${testId}`)
}

/**
 * Resume A/B test
 */
export async function resumeABTest(testId: string): Promise<void> {
  await supabase
    .from('ab_tests')
    .update({ status: 'active' })
    .eq('id', testId)

  console.log(`✓ Resumed A/B test ${testId}`)
}

/**
 * End A/B test and mark as completed
 */
export async function endABTest(testId: string): Promise<ABTestResults> {
  await supabase
    .from('ab_tests')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    .eq('id', testId)

  const results = await getABTestResults(testId)

  console.log(`✓ Ended A/B test ${testId}`)
  console.log('Results:', JSON.stringify(results, null, 2))

  return results
}

/**
 * Get winning variant from A/B test
 * Winner is variant with highest conversion rate (bookings / total calls)
 */
export function getWinningVariant(results: ABTestResults): {
  variant_id: string
  variant_name: string
  conversion_rate: number
  statistical_significance?: number
} {
  if (results.variants.length === 0) {
    throw new Error('No variants in test results')
  }

  // Sort by conversion rate
  const sorted = [...results.variants].sort(
    (a, b) => b.conversion_rate - a.conversion_rate
  )

  const winner = sorted[0]

  return {
    variant_id: winner.variant_id,
    variant_name: winner.variant_name,
    conversion_rate: winner.conversion_rate,
  }
}
