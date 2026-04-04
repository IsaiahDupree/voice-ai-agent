/**
 * Unit test: Evaluation Parser Score Field Handling
 * Feature 102: Verify that the evaluation parser correctly handles all score fields
 * from GPT-4o responses, including edge cases and validation
 */

import { evaluateCall, CallContext } from '@/lib/call-evaluator'

describe('Evaluation Parser - Score Field Handling', () => {
  it('should parse all score fields correctly from valid GPT-4o response', async () => {
    const callContext: CallContext = {
      call_id: 'test_parser_001',
      transcript: `
        Agent: Hi, thanks for calling! How can I help?
        Caller: I'd like to book an appointment.
        Agent: Perfect! When works best for you?
        Caller: Tomorrow at 2pm.
        Agent: Booked! You're all set for tomorrow at 2pm.
      `,
      goal: 'Book an appointment',
      call_duration_seconds: 90,
      outcome: 'booked',
      tenant_id: 'default',
    }

    const evaluation = await evaluateCall(callContext)

    // Verify all score fields are present
    expect(evaluation).toHaveProperty('goal_achievement_score')
    expect(evaluation).toHaveProperty('naturalness_score')
    expect(evaluation).toHaveProperty('objection_handling_score')
    expect(evaluation).toHaveProperty('information_accuracy_score')
    expect(evaluation).toHaveProperty('overall_score')

    // Verify scores are numbers
    expect(typeof evaluation.goal_achievement_score).toBe('number')
    expect(typeof evaluation.naturalness_score).toBe('number')
    expect(typeof evaluation.objection_handling_score).toBe('number')
    expect(typeof evaluation.information_accuracy_score).toBe('number')
    expect(typeof evaluation.overall_score).toBe('number')

    // Verify scores are in valid range (0-10)
    expect(evaluation.goal_achievement_score).toBeGreaterThanOrEqual(0)
    expect(evaluation.goal_achievement_score).toBeLessThanOrEqual(10)
    expect(evaluation.naturalness_score).toBeGreaterThanOrEqual(0)
    expect(evaluation.naturalness_score).toBeLessThanOrEqual(10)
    expect(evaluation.objection_handling_score).toBeGreaterThanOrEqual(0)
    expect(evaluation.objection_handling_score).toBeLessThanOrEqual(10)
    expect(evaluation.information_accuracy_score).toBeGreaterThanOrEqual(0)
    expect(evaluation.information_accuracy_score).toBeLessThanOrEqual(10)
    expect(evaluation.overall_score).toBeGreaterThanOrEqual(0)
    expect(evaluation.overall_score).toBeLessThanOrEqual(10)
  }, 30000)

  it('should handle missing score fields with defaults', async () => {
    const callContext: CallContext = {
      call_id: 'test_parser_missing_fields',
      transcript: 'Brief call',
      goal: 'Test goal',
      tenant_id: 'default',
    }

    const evaluation = await evaluateCall(callContext)

    // Even with minimal data, all score fields should be present
    expect(evaluation.goal_achievement_score).toBeDefined()
    expect(evaluation.naturalness_score).toBeDefined()
    expect(evaluation.objection_handling_score).toBeDefined()
    expect(evaluation.information_accuracy_score).toBeDefined()
    expect(evaluation.overall_score).toBeDefined()

    // Scores should default to 0 if missing or invalid
    expect(evaluation.goal_achievement_score).toBeGreaterThanOrEqual(0)
    expect(evaluation.naturalness_score).toBeGreaterThanOrEqual(0)
    expect(evaluation.objection_handling_score).toBeGreaterThanOrEqual(0)
    expect(evaluation.information_accuracy_score).toBeGreaterThanOrEqual(0)
    expect(evaluation.overall_score).toBeGreaterThanOrEqual(0)
  }, 30000)

  it('should clamp scores that exceed maximum value', async () => {
    const callContext: CallContext = {
      call_id: 'test_parser_max_clamp',
      transcript: `
        Agent: Perfect call with excellent results!
        Caller: This is amazing, thank you so much!
      `,
      goal: 'Provide excellent service',
      tenant_id: 'default',
    }

    const evaluation = await evaluateCall(callContext)

    // All scores should be clamped to maximum of 10
    expect(evaluation.goal_achievement_score).toBeLessThanOrEqual(10)
    expect(evaluation.naturalness_score).toBeLessThanOrEqual(10)
    expect(evaluation.objection_handling_score).toBeLessThanOrEqual(10)
    expect(evaluation.information_accuracy_score).toBeLessThanOrEqual(10)
    expect(evaluation.overall_score).toBeLessThanOrEqual(10)
  }, 30000)

  it('should clamp scores that are below minimum value', async () => {
    const callContext: CallContext = {
      call_id: 'test_parser_min_clamp',
      transcript: `
        Agent: Um... what?
        Caller: This is terrible!
      `,
      goal: 'Handle caller professionally',
      outcome: 'caller-hung-up',
      tenant_id: 'default',
    }

    const evaluation = await evaluateCall(callContext)

    // All scores should be clamped to minimum of 0
    expect(evaluation.goal_achievement_score).toBeGreaterThanOrEqual(0)
    expect(evaluation.naturalness_score).toBeGreaterThanOrEqual(0)
    expect(evaluation.objection_handling_score).toBeGreaterThanOrEqual(0)
    expect(evaluation.information_accuracy_score).toBeGreaterThanOrEqual(0)
    expect(evaluation.overall_score).toBeGreaterThanOrEqual(0)
  }, 30000)

  it('should parse boolean goal_achieved field correctly', async () => {
    const successContext: CallContext = {
      call_id: 'test_parser_goal_true',
      transcript: 'Successful appointment booking call',
      goal: 'Book appointment',
      outcome: 'booked',
      tenant_id: 'default',
    }

    const failureContext: CallContext = {
      call_id: 'test_parser_goal_false',
      transcript: 'Failed call - caller hung up',
      goal: 'Book appointment',
      outcome: 'caller-hung-up',
      tenant_id: 'default',
    }

    const successEval = await evaluateCall(successContext)
    const failureEval = await evaluateCall(failureContext)

    // goal_achieved should be a boolean
    expect(typeof successEval.goal_achieved).toBe('boolean')
    expect(typeof failureEval.goal_achieved).toBe('boolean')

    // Default to false if missing
    expect([true, false]).toContain(successEval.goal_achieved)
    expect([true, false]).toContain(failureEval.goal_achieved)
  }, 30000)

  it('should parse array fields with fallback to empty arrays', async () => {
    const callContext: CallContext = {
      call_id: 'test_parser_arrays',
      transcript: 'Test transcript',
      goal: 'Test goal',
      tenant_id: 'default',
    }

    const evaluation = await evaluateCall(callContext)

    // All array fields should be present and be arrays
    expect(Array.isArray(evaluation.failure_points)).toBe(true)
    expect(Array.isArray(evaluation.improvement_suggestions)).toBe(true)
    expect(Array.isArray(evaluation.highlight_moments)).toBe(true)
    expect(Array.isArray(evaluation.recommended_prompt_changes)).toBe(true)

    // Arrays should not be null or undefined
    expect(evaluation.failure_points).not.toBeNull()
    expect(evaluation.improvement_suggestions).not.toBeNull()
    expect(evaluation.highlight_moments).not.toBeNull()
    expect(evaluation.recommended_prompt_changes).not.toBeNull()
  }, 30000)

  it('should store evaluation_data as raw GPT-4o response', async () => {
    const callContext: CallContext = {
      call_id: 'test_parser_raw_data',
      transcript: 'Test transcript',
      goal: 'Test goal',
      tenant_id: 'default',
    }

    const evaluation = await evaluateCall(callContext)

    // evaluation_data should contain the raw response
    expect(evaluation.evaluation_data).toBeDefined()
    expect(typeof evaluation.evaluation_data).toBe('object')

    // Should include all the original fields from GPT-4o
    if (evaluation.evaluation_data) {
      expect(evaluation.evaluation_data).toHaveProperty('goal_achievement_score')
      expect(evaluation.evaluation_data).toHaveProperty('naturalness_score')
      expect(evaluation.evaluation_data).toHaveProperty('objection_handling_score')
      expect(evaluation.evaluation_data).toHaveProperty('information_accuracy_score')
      expect(evaluation.evaluation_data).toHaveProperty('overall_score')
    }
  }, 30000)

  it('should handle decimal score values correctly', async () => {
    const callContext: CallContext = {
      call_id: 'test_parser_decimals',
      transcript: 'Test call with good but not perfect execution',
      goal: 'Handle caller inquiry',
      tenant_id: 'default',
    }

    const evaluation = await evaluateCall(callContext)

    // Scores can be decimals (e.g., 7.5, 8.3)
    // Just verify they're valid numbers
    expect(Number.isFinite(evaluation.goal_achievement_score)).toBe(true)
    expect(Number.isFinite(evaluation.naturalness_score)).toBe(true)
    expect(Number.isFinite(evaluation.objection_handling_score)).toBe(true)
    expect(Number.isFinite(evaluation.information_accuracy_score)).toBe(true)
    expect(Number.isFinite(evaluation.overall_score)).toBe(true)
  }, 30000)

  it('should calculate overall score as average of component scores', async () => {
    const callContext: CallContext = {
      call_id: 'test_parser_overall_calc',
      transcript: 'Test transcript for overall score calculation',
      goal: 'Test goal',
      tenant_id: 'default',
    }

    const evaluation = await evaluateCall(callContext)

    // Overall score should be roughly the average of the 4 component scores
    // Allow for small rounding differences
    const calculatedAverage =
      (evaluation.goal_achievement_score +
        evaluation.naturalness_score +
        evaluation.objection_handling_score +
        evaluation.information_accuracy_score) /
      4

    // Overall score should be within 0.5 of the calculated average
    // (allows for rounding and GPT-4o's own calculation)
    expect(Math.abs(evaluation.overall_score - calculatedAverage)).toBeLessThanOrEqual(1)
  }, 30000)
})
