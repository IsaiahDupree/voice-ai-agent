// Feature 39: Integration test: getCallerMemory returns profile on second call
/**
 * Integration test for getCallerProfile function
 * Tests that caller profiles are retrieved correctly for returning callers
 */

import { getCallerProfile, upsertCallerProfile, deleteCallerProfile, formatCallerContext } from '@/lib/caller-memory';
import { supabaseAdmin } from '@/lib/supabase';

describe('Caller Memory - GET Integration', () => {
  const testPhoneNumber = '+15555550101';
  const testTenantId = 'test-tenant';

  beforeAll(async () => {
    // Clean up any existing test data
    await deleteCallerProfile(testPhoneNumber, testTenantId);
  });

  afterAll(async () => {
    // Clean up test data
    await deleteCallerProfile(testPhoneNumber, testTenantId);
  });

  it('should return null for a new caller (first call)', async () => {
    const profile = await getCallerProfile(testPhoneNumber, testTenantId);

    expect(profile).toBeNull();
  });

  it('should return profile on second call after creating one', async () => {
    // First, insert a caller profile (simulating the first call completed)
    const { data: insertedProfile, error } = await supabaseAdmin
      .from('caller_memory')
      .insert({
        phone_number: testPhoneNumber,
        tenant_id: testTenantId,
        display_name: 'Test Caller',
        call_count: 1,
        first_call_at: new Date().toISOString(),
        last_call_at: new Date().toISOString(),
        summary: 'First call summary: interested in pricing plans.',
        preferences: { preferredChannel: 'sms' },
        relationship_score: 25,
        last_offer_made: 'Premium Plan',
        last_offer_outcome: 'pending',
        notes: 'Follow up in 3 days',
        metadata: {},
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
    }
    expect(insertedProfile).toBeTruthy();

    // Now fetch the profile
    const profile = await getCallerProfile(testPhoneNumber, testTenantId);

    expect(profile).toBeTruthy();
    expect(profile!.displayName).toBe('Test Caller');
    expect(profile!.phoneNumber).toBe(testPhoneNumber);
    expect(profile!.callCount).toBe(1);
    expect(profile!.relationshipScore).toBe(25);
    expect(profile!.lastOfferMade).toBe('Premium Plan');
    expect(profile!.lastOfferOutcome).toBe('pending');
    expect(profile!.summary).toContain('First call summary');
  });

  it('should format caller context for system prompt injection', async () => {
    const profile = await getCallerProfile(testPhoneNumber, testTenantId);
    expect(profile).toBeTruthy();

    const context = formatCallerContext(profile!);

    expect(context).toBeTruthy();
    expect(context).toContain('Test Caller');
    expect(context).toContain('call #1');
    expect(context).toContain('Premium Plan');
  });

  it('should retrieve profile with correct tenant isolation', async () => {
    // Try to fetch with wrong tenant ID
    const wrongTenantProfile = await getCallerProfile(testPhoneNumber, 'wrong-tenant');
    expect(wrongTenantProfile).toBeNull();

    // Correct tenant should work
    const correctTenantProfile = await getCallerProfile(testPhoneNumber, testTenantId);
    expect(correctTenantProfile).toBeTruthy();
    expect(correctTenantProfile!.displayName).toBe('Test Caller');
  });
});
