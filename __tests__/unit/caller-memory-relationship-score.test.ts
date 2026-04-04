// Feature 42: Unit test: relationship score calculation algorithm
/**
 * Unit test for calculateRelationshipScore function
 * Tests the scoring algorithm with various call contexts
 */

import { calculateRelationshipScore } from '@/lib/caller-memory';

describe('Caller Memory - Relationship Score Calculation', () => {
  it('should start at 0 for baseline with neutral call', () => {
    const score = calculateRelationshipScore(0, {
      callId: 'test',
      sentiment: 'neutral',
      outcome: 'completed',
    });

    // neutral sentiment (+1) + completed (+3) = +4
    expect(score).toBe(4);
  });

  it('should increase score for positive sentiment', () => {
    const score = calculateRelationshipScore(50, {
      callId: 'test',
      sentiment: 'positive',
      outcome: 'completed',
    });

    // positive (+5) + completed (+3) = +8
    expect(score).toBe(58);
  });

  it('should decrease score for negative sentiment', () => {
    const score = calculateRelationshipScore(50, {
      callId: 'test',
      sentiment: 'negative',
      outcome: 'completed',
    });

    // negative (-5) + completed (+3) = -2
    expect(score).toBe(48);
  });

  it('should give high boost for booking_made outcome', () => {
    const score = calculateRelationshipScore(30, {
      callId: 'test',
      sentiment: 'positive',
      outcome: 'booking_made',
    });

    // positive (+5) + booking_made (+15) = +20
    expect(score).toBe(50);
  });

  it('should penalize abandoned calls', () => {
    const score = calculateRelationshipScore(50, {
      callId: 'test',
      sentiment: 'neutral',
      outcome: 'abandoned',
    });

    // neutral (+1) + abandoned (-3) = -2
    expect(score).toBe(48);
  });

  it('should reward accepted offers', () => {
    const score = calculateRelationshipScore(40, {
      callId: 'test',
      sentiment: 'positive',
      outcome: 'completed',
      offerOutcome: 'accepted',
    });

    // positive (+5) + completed (+3) + accepted (+10) = +18
    expect(score).toBe(58);
  });

  it('should penalize declined offers', () => {
    const score = calculateRelationshipScore(50, {
      callId: 'test',
      sentiment: 'neutral',
      outcome: 'completed',
      offerOutcome: 'declined',
    });

    // neutral (+1) + completed (+3) + declined (-2) = +2
    expect(score).toBe(52);
  });

  it('should reward long call duration (>5 minutes)', () => {
    const score = calculateRelationshipScore(40, {
      callId: 'test',
      sentiment: 'neutral',
      outcome: 'completed',
      duration: 350, // 5+ minutes
    });

    // neutral (+1) + completed (+3) + long duration (+5) = +9
    expect(score).toBe(49);
  });

  it('should give moderate boost for medium duration (2-5 minutes)', () => {
    const score = calculateRelationshipScore(40, {
      callId: 'test',
      sentiment: 'neutral',
      outcome: 'completed',
      duration: 180, // 3 minutes
    });

    // neutral (+1) + completed (+3) + medium duration (+2) = +6
    expect(score).toBe(46);
  });

  it('should not boost for short calls (<2 minutes)', () => {
    const score = calculateRelationshipScore(40, {
      callId: 'test',
      sentiment: 'neutral',
      outcome: 'completed',
      duration: 90, // 1.5 minutes
    });

    // neutral (+1) + completed (+3) + no duration bonus = +4
    expect(score).toBe(44);
  });

  it('should cap score at 100 (upper bound)', () => {
    const score = calculateRelationshipScore(95, {
      callId: 'test',
      sentiment: 'positive',
      outcome: 'booking_made',
      offerOutcome: 'accepted',
      duration: 400,
    });

    // positive (+5) + booking_made (+15) + accepted (+10) + long duration (+5) = +35
    // 95 + 35 = 130, but should cap at 100
    expect(score).toBe(100);
  });

  it('should floor score at 0 (lower bound)', () => {
    const score = calculateRelationshipScore(5, {
      callId: 'test',
      sentiment: 'negative',
      outcome: 'abandoned',
      offerOutcome: 'declined',
    });

    // negative (-5) + abandoned (-3) + declined (-2) = -10
    // 5 - 10 = -5, but should floor at 0
    expect(score).toBe(0);
  });

  it('should handle transferred calls neutrally', () => {
    const score = calculateRelationshipScore(50, {
      callId: 'test',
      sentiment: 'neutral',
      outcome: 'transferred',
    });

    // neutral (+1) + transferred (+1) = +2
    expect(score).toBe(52);
  });

  it('should calculate correctly for complex scenarios', () => {
    // Scenario: Positive call with booking, accepted offer, long duration
    const score = calculateRelationshipScore(60, {
      callId: 'test',
      sentiment: 'positive',
      outcome: 'booking_made',
      offerOutcome: 'accepted',
      duration: 500, // 8+ minutes
    });

    // positive (+5) + booking_made (+15) + accepted (+10) + long duration (+5) = +35
    expect(score).toBe(95);
  });

  it('should handle missing optional fields gracefully', () => {
    const score = calculateRelationshipScore(50, {
      callId: 'test',
      // No sentiment, outcome, duration, or offer fields
    });

    // All deltas are 0, score should remain unchanged
    expect(score).toBe(50);
  });

  it('should consistently produce same score for same inputs', () => {
    const context = {
      callId: 'test',
      sentiment: 'positive' as const,
      outcome: 'completed' as const,
      duration: 200,
    };

    const score1 = calculateRelationshipScore(30, context);
    const score2 = calculateRelationshipScore(30, context);

    expect(score1).toBe(score2);
    expect(score1).toBe(40); // positive (+5) + completed (+3) + medium duration (+2) = +10
  });

  it('should handle edge case: perfect call from 0', () => {
    const score = calculateRelationshipScore(0, {
      callId: 'test',
      sentiment: 'positive',
      outcome: 'booking_made',
      offerOutcome: 'accepted',
      duration: 600,
    });

    // positive (+5) + booking_made (+15) + accepted (+10) + long duration (+5) = +35
    expect(score).toBe(35);
  });

  it('should handle edge case: worst call from 100', () => {
    const score = calculateRelationshipScore(100, {
      callId: 'test',
      sentiment: 'negative',
      outcome: 'abandoned',
      offerOutcome: 'declined',
    });

    // negative (-5) + abandoned (-3) + declined (-2) = -10
    expect(score).toBe(90);
  });
});
