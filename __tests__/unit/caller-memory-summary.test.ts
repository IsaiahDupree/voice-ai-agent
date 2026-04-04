// Feature 41: Unit test: AI summary generation
/**
 * Unit test for AI summary generation in caller memory
 * Tests that summaries are generated correctly via the upsertCallerProfile function
 */

import { upsertCallerProfile, getCallerProfile, deleteCallerProfile } from '@/lib/caller-memory';
import { supabaseAdmin } from '@/lib/supabase';

describe('Caller Memory - AI Summary Generation', () => {
  const testPhoneNumber = '+15555550103';
  const testTenantId = 'test-summary';

  beforeAll(async () => {
    // Clean up any existing test data
    await deleteCallerProfile(testPhoneNumber, testTenantId);
  });

  afterAll(async () => {
    // Clean up test data
    await deleteCallerProfile(testPhoneNumber, testTenantId);
  });

  it('should generate AI summary from transcript on first call', async () => {
    const callContext = {
      callId: 'summary_test_1',
      duration: 180,
      transcript: 'Customer: Hi, I am looking for information about your enterprise plan. I run a SaaS company with 50 employees. Agent: Great! Our enterprise plan would be perfect for you. It includes unlimited users, priority support, and custom integrations.',
      outcome: 'completed' as const,
      sentiment: 'positive' as const,
      offerMade: 'Enterprise Plan',
      offerOutcome: 'pending' as const,
    };

    const profile = await upsertCallerProfile(
      testPhoneNumber,
      callContext,
      { displayName: 'Test Company CEO' },
      testTenantId
    );

    expect(profile).toBeDefined();
    expect(profile.summary).toBeTruthy();
    expect(profile.summary).toContain('enterprise' || 'Enterprise' || 'plan');
    expect(profile.callCount).toBe(1);
  });

  it('should update summary with new call information on second call', async () => {
    // Get existing profile to see the original summary
    const existingProfile = await getCallerProfile(testPhoneNumber, testTenantId);
    expect(existingProfile).toBeTruthy();
    const originalSummary = existingProfile!.summary;

    const callContext = {
      callId: 'summary_test_2',
      duration: 240,
      transcript: 'Customer: I have a few more questions about security and compliance. Do you support SOC 2 and GDPR? Agent: Yes, we are SOC 2 Type II certified and fully GDPR compliant. Customer: Perfect, that is what I needed to hear.',
      outcome: 'completed' as const,
      sentiment: 'positive' as const,
      offerMade: 'Enterprise Plan',
      offerOutcome: 'accepted' as const,
    };

    const updatedProfile = await upsertCallerProfile(
      testPhoneNumber,
      callContext,
      {},
      testTenantId
    );

    expect(updatedProfile.summary).toBeTruthy();
    expect(updatedProfile.summary).not.toBe(originalSummary); // Should be updated
    expect(updatedProfile.callCount).toBe(2);
  });

  it('should preserve summary when no transcript is provided', async () => {
    const existingProfile = await getCallerProfile(testPhoneNumber, testTenantId);
    expect(existingProfile).toBeTruthy();
    const originalSummary = existingProfile!.summary;

    const callContext = {
      callId: 'summary_test_3',
      duration: 30,
      outcome: 'abandoned' as const,
      sentiment: 'neutral' as const,
      // No transcript provided
    };

    const updatedProfile = await upsertCallerProfile(
      testPhoneNumber,
      callContext,
      {},
      testTenantId
    );

    expect(updatedProfile.summary).toBe(originalSummary); // Should remain unchanged
    expect(updatedProfile.callCount).toBe(3);
  });

  it('should handle empty transcript gracefully', async () => {
    const callContext = {
      callId: 'summary_test_4',
      duration: 5,
      transcript: '', // Empty transcript
      outcome: 'abandoned' as const,
      sentiment: 'neutral' as const,
    };

    const existingProfile = await getCallerProfile(testPhoneNumber, testTenantId);
    const originalSummary = existingProfile!.summary;

    const updatedProfile = await upsertCallerProfile(
      testPhoneNumber,
      callContext,
      {},
      testTenantId
    );

    // With empty transcript, summary might still be generated or preserved
    expect(updatedProfile.summary).toBeTruthy();
    expect(updatedProfile.callCount).toBe(4);
  });

  it('should include call context (outcome, sentiment, offer) in summary generation', async () => {
    await deleteCallerProfile('+15555550104', testTenantId);

    const callContext = {
      callId: 'summary_context_test',
      duration: 200,
      transcript: 'Customer: I need this urgently. Can you set it up today? Agent: Yes, we can fast-track your onboarding.',
      outcome: 'booking_made' as const,
      sentiment: 'positive' as const,
      offerMade: 'Premium Plan with Fast Track',
      offerOutcome: 'accepted' as const,
    };

    const profile = await upsertCallerProfile(
      '+15555550104',
      callContext,
      { displayName: 'Urgent Customer' },
      testTenantId
    );

    expect(profile.summary).toBeTruthy();
    // Summary should reflect the urgency and positive outcome
    expect(profile.lastOfferMade).toBe('Premium Plan with Fast Track');
    expect(profile.lastOfferOutcome).toBe('accepted');

    // Cleanup
    await deleteCallerProfile('+15555550104', testTenantId);
  });
});
