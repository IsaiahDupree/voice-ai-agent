// Feature 40: Integration test: updateCallerMemory persists call summary
/**
 * Integration test for upsertCallerProfile function
 * Tests that call summaries and profiles are persisted after calls
 */

import { upsertCallerProfile, getCallerProfile, deleteCallerProfile } from '@/lib/caller-memory';
import { supabaseAdmin } from '@/lib/supabase';

describe('Caller Memory - UPDATE Integration', () => {
  const testPhoneNumber = '+15555550102';
  const testTenantId = 'test-tenant';

  beforeAll(async () => {
    // Clean up any existing test data
    await deleteCallerProfile(testPhoneNumber, testTenantId);
  });

  afterAll(async () => {
    // Clean up test data
    await deleteCallerProfile(testPhoneNumber, testTenantId);
  });

  it('should create new caller profile on first call update', async () => {
    const callContext = {
      callId: 'call_update_test_1',
      duration: 180,
      transcript: 'Customer: Hi, I am interested in your premium plan. Agent: Great! Let me tell you about it...',
      outcome: 'completed' as const,
      sentiment: 'positive' as const,
      offerMade: 'Premium Plan',
      offerOutcome: 'pending' as const,
    };

    const profile = await upsertCallerProfile(
      testPhoneNumber,
      callContext,
      { displayName: 'Jane Smith', notes: 'High intent, follow up tomorrow' },
      testTenantId
    );

    expect(profile).toBeDefined();
    expect(profile.phoneNumber).toBe(testPhoneNumber);
    expect(profile.displayName).toBe('Jane Smith');
    expect(profile.callCount).toBe(1);
    expect(profile.summary).toBeTruthy(); // AI-generated summary
    expect(profile.relationshipScore).toBeGreaterThan(0);

    // Verify it was actually persisted in the database
    const dbProfile = await getCallerProfile(testPhoneNumber, testTenantId);
    expect(dbProfile).toBeTruthy();
    expect(dbProfile!.displayName).toBe('Jane Smith');
    expect(dbProfile!.callCount).toBe(1);
    expect(dbProfile!.summary).toBeTruthy();
    expect(dbProfile!.relationshipScore).toBeGreaterThan(0);
  });

  it('should update existing profile and increment call count on repeat call', async () => {
    const callContext = {
      callId: 'call_update_test_2',
      duration: 240,
      transcript: 'Customer: I am ready to sign up for the premium plan. Agent: Excellent choice!',
      outcome: 'booking_made' as const,
      sentiment: 'positive' as const,
      offerMade: 'Premium Plan',
      offerOutcome: 'accepted' as const,
    };

    const profile = await upsertCallerProfile(
      testPhoneNumber,
      callContext,
      {},
      testTenantId
    );

    expect(profile.callCount).toBe(2); // Incremented from 1
    expect(profile.relationshipScore).toBeGreaterThan(25); // Should be higher due to booking + positive sentiment

    // Verify persistence
    const dbProfile = await getCallerProfile(testPhoneNumber, testTenantId);
    expect(dbProfile!.callCount).toBe(2);
    expect(dbProfile!.lastOfferOutcome).toBe('accepted');
  });

  it('should handle updates without transcript (no new summary generated)', async () => {
    const callContext = {
      callId: 'call_update_test_3',
      duration: 30,
      outcome: 'abandoned' as const,
      sentiment: 'neutral' as const,
    };

    const profile = await upsertCallerProfile(
      testPhoneNumber,
      callContext,
      { notes: 'Called back but hung up quickly' },
      testTenantId
    );

    expect(profile.callCount).toBe(3);
    expect(profile.notes).toBe('Called back but hung up quickly');
  });

  it('should preserve summary when no transcript is provided', async () => {
    const beforeProfile = await getCallerProfile(testPhoneNumber, testTenantId);
    const originalSummary = beforeProfile!.summary;

    const callContext = {
      callId: 'call_update_test_4',
      duration: 15,
      outcome: 'abandoned' as const,
      sentiment: 'neutral' as const,
      // No transcript
    };

    const profile = await upsertCallerProfile(
      testPhoneNumber,
      callContext,
      {},
      testTenantId
    );

    expect(profile.summary).toBe(originalSummary); // Should remain unchanged
    expect(profile.callCount).toBe(4);
  });

  it('should update relationship score based on call context', async () => {
    const beforeProfile = await getCallerProfile(testPhoneNumber, testTenantId);
    const scoreBefore = beforeProfile!.relationshipScore;

    // Positive call should increase score
    const callContext = {
      callId: 'call_update_test_5',
      duration: 300,
      outcome: 'completed' as const,
      sentiment: 'positive' as const,
    };

    const profile = await upsertCallerProfile(
      testPhoneNumber,
      callContext,
      {},
      testTenantId
    );

    expect(profile.relationshipScore).toBeGreaterThan(scoreBefore);
    expect(profile.callCount).toBe(5);
  });
});
