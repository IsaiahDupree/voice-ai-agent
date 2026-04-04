/**
 * Caller Memory
 * Per-caller profile management for personalized conversations
 */

import OpenAI from 'openai';
import { supabaseAdmin } from './supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CallerProfile {
  id: number;
  phoneNumber: string;
  tenantId: string;
  displayName: string | null;
  callCount: number;
  firstCallAt: string | null;
  lastCallAt: string | null;
  summary: string | null;
  preferences: Record<string, any>;
  relationshipScore: number;
  lastOfferMade: string | null;
  lastOfferOutcome: string | null;
  notes: string | null;
  metadata: Record<string, any>;
}

export interface CallContext {
  callId: string;
  duration?: number;
  transcript?: string;
  outcome?: 'completed' | 'abandoned' | 'transferred' | 'booking_made';
  offerMade?: string;
  offerOutcome?: 'accepted' | 'declined' | 'pending';
  sentiment?: 'positive' | 'neutral' | 'negative';
  topics?: string[];
}

/**
 * Fetch caller profile by phone number
 */
export async function getCallerProfile(
  phoneNumber: string,
  tenantId: string = 'default'
): Promise<CallerProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('caller_memory')
    .select('*')
    .eq('phone_number', phoneNumber)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    phoneNumber: data.phone_number,
    tenantId: data.tenant_id,
    displayName: data.display_name,
    callCount: data.call_count,
    firstCallAt: data.first_call_at,
    lastCallAt: data.last_call_at,
    summary: data.summary,
    preferences: data.preferences || {},
    relationshipScore: data.relationship_score,
    lastOfferMade: data.last_offer_made,
    lastOfferOutcome: data.last_offer_outcome,
    notes: data.notes,
    metadata: data.metadata || {},
  };
}

/**
 * Create or update caller profile after a call
 */
export async function upsertCallerProfile(
  phoneNumber: string,
  callContext: CallContext,
  updates: Partial<CallerProfile> = {},
  tenantId: string = 'default'
): Promise<CallerProfile> {
  // Fetch existing profile
  const existing = await getCallerProfile(phoneNumber, tenantId);

  // Generate updated summary if transcript is available
  let newSummary = existing?.summary || null;
  if (callContext.transcript) {
    newSummary = await generateCallSummary(
      callContext.transcript,
      existing?.summary || null,
      callContext
    );
  }

  // Calculate new relationship score
  const newScore = calculateRelationshipScore(
    existing?.relationshipScore || 0,
    callContext
  );

  // Prepare upsert data
  const upsertData = {
    phone_number: phoneNumber,
    tenant_id: tenantId,
    display_name: updates.displayName || existing?.displayName || null,
    call_count: (existing?.callCount || 0) + 1,
    first_call_at: existing?.firstCallAt || new Date().toISOString(),
    last_call_at: new Date().toISOString(),
    summary: newSummary,
    preferences: {
      ...(existing?.preferences || {}),
      ...(updates.preferences || {}),
    },
    relationship_score: newScore,
    last_offer_made: callContext.offerMade || existing?.lastOfferMade,
    last_offer_outcome: callContext.offerOutcome || existing?.lastOfferOutcome,
    notes: updates.notes || existing?.notes,
    metadata: {
      ...(existing?.metadata || {}),
      ...(updates.metadata || {}),
      lastCallId: callContext.callId,
      lastCallDuration: callContext.duration,
      lastCallOutcome: callContext.outcome,
      lastCallSentiment: callContext.sentiment,
    },
  };

  const { data, error } = await supabaseAdmin
    .from('caller_memory')
    .upsert(upsertData, {
      onConflict: 'phone_number,tenant_id',
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to upsert caller profile: ${error?.message}`);
  }

  return {
    id: data.id,
    phoneNumber: data.phone_number,
    tenantId: data.tenant_id,
    displayName: data.display_name,
    callCount: data.call_count,
    firstCallAt: data.first_call_at,
    lastCallAt: data.last_call_at,
    summary: data.summary,
    preferences: data.preferences || {},
    relationshipScore: data.relationship_score,
    lastOfferMade: data.last_offer_made,
    lastOfferOutcome: data.last_offer_outcome,
    notes: data.notes,
    metadata: data.metadata || {},
  };
}

/**
 * Generate AI rolling summary of caller relationship
 */
async function generateCallSummary(
  transcript: string,
  existingSummary: string | null,
  context: CallContext
): Promise<string> {
  const systemPrompt = `You are a relationship summarizer. Generate a concise summary of this caller's history and preferences based on the new call transcript and existing summary.

Keep the summary under 150 words. Focus on:
- What the caller wants or needs
- Their preferences and pain points
- Relationship status (new lead, warm prospect, existing customer, etc.)
- Any commitments made or next steps
- Topics they care about

Make it actionable for the next agent who speaks with this caller.`;

  const userPrompt = `Existing Summary:
${existingSummary || 'This is the first call with this person.'}

New Call Transcript:
${transcript.substring(0, 2000)}

Call Context:
- Outcome: ${context.outcome || 'unknown'}
- Sentiment: ${context.sentiment || 'unknown'}
- Offer Made: ${context.offerMade || 'none'}
- Offer Outcome: ${context.offerOutcome || 'N/A'}

Generate an updated summary:`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 250,
    temperature: 0.3,
  });

  return response.choices[0].message.content || existingSummary || '';
}

/**
 * Calculate relationship score (0-100)
 * Factors:
 * - Call frequency
 * - Call duration
 * - Sentiment
 * - Outcomes (bookings, accepted offers)
 */
export function calculateRelationshipScore(
  currentScore: number,
  context: CallContext
): number {
  let delta = 0;

  // Sentiment impact
  switch (context.sentiment) {
    case 'positive':
      delta += 5;
      break;
    case 'negative':
      delta -= 5;
      break;
    case 'neutral':
      delta += 1;
      break;
  }

  // Outcome impact
  switch (context.outcome) {
    case 'booking_made':
      delta += 15;
      break;
    case 'completed':
      delta += 3;
      break;
    case 'abandoned':
      delta -= 3;
      break;
    case 'transferred':
      delta += 1;
      break;
  }

  // Offer outcome impact
  switch (context.offerOutcome) {
    case 'accepted':
      delta += 10;
      break;
    case 'declined':
      delta -= 2;
      break;
  }

  // Duration impact (longer calls = more engaged)
  if (context.duration) {
    if (context.duration > 300) {
      // > 5 minutes
      delta += 5;
    } else if (context.duration > 120) {
      // > 2 minutes
      delta += 2;
    }
  }

  const newScore = Math.max(0, Math.min(100, currentScore + delta));

  return newScore;
}

/**
 * List all callers sorted by relationship score
 */
export async function listTopCallers(
  tenantId: string = 'default',
  limit: number = 50
): Promise<CallerProfile[]> {
  const { data, error } = await supabaseAdmin
    .from('caller_memory')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('relationship_score', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    phoneNumber: row.phone_number,
    tenantId: row.tenant_id,
    displayName: row.display_name,
    callCount: row.call_count,
    firstCallAt: row.first_call_at,
    lastCallAt: row.last_call_at,
    summary: row.summary,
    preferences: row.preferences || {},
    relationshipScore: row.relationship_score,
    lastOfferMade: row.last_offer_made,
    lastOfferOutcome: row.last_offer_outcome,
    notes: row.notes,
    metadata: row.metadata || {},
  }));
}

/**
 * Delete a caller profile
 */
export async function deleteCallerProfile(
  phoneNumber: string,
  tenantId: string = 'default'
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('caller_memory')
    .delete()
    .eq('phone_number', phoneNumber)
    .eq('tenant_id', tenantId);

  return !error;
}

/**
 * Format caller context for system prompt injection
 */
export function formatCallerContext(profile: CallerProfile): string {
  const parts: string[] = [];

  if (profile.displayName) {
    parts.push(`Caller: ${profile.displayName} (${profile.phoneNumber})`);
  } else {
    parts.push(`Caller: ${profile.phoneNumber}`);
  }

  if (profile.callCount > 1) {
    parts.push(`This is call #${profile.callCount} with this person.`);
  } else {
    parts.push(`This is their first call.`);
  }

  if (profile.summary) {
    parts.push(`\nHistory: ${profile.summary}`);
  }

  if (profile.lastOfferMade) {
    parts.push(
      `\nLast offer: ${profile.lastOfferMade} (${profile.lastOfferOutcome || 'pending'})`
    );
  }

  if (profile.relationshipScore) {
    let relationshipLevel = 'new';
    if (profile.relationshipScore >= 75) {
      relationshipLevel = 'strong';
    } else if (profile.relationshipScore >= 50) {
      relationshipLevel = 'warm';
    } else if (profile.relationshipScore >= 25) {
      relationshipLevel = 'developing';
    }
    parts.push(`\nRelationship: ${relationshipLevel} (score: ${profile.relationshipScore}/100)`);
  }

  return parts.join(' ');
}
