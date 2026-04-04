/**
 * POST /api/tools/updateCallerMemory
 * Vapi function tool to update caller profile after call ends
 */

import { NextRequest, NextResponse } from 'next/server';
import { upsertCallerProfile } from '@/lib/caller-memory';
import { withTelemetry } from '@/lib/tool-telemetry';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    phoneNumber,
    callId,
    name,
    transcript,
    duration,
    outcome,
    offerMade,
    offerOutcome,
    sentiment,
    topics,
    notes,
    tenantId = 'default',
  } = body;

  return withTelemetry('updateCallerMemory', callId, body, async () => {
    if (!phoneNumber || !callId) {
      return NextResponse.json(
        { error: 'phoneNumber and callId are required' },
        { status: 400 }
      );
    }

    try {
      const callContext = {
        callId,
        duration,
        transcript,
        outcome,
        offerMade,
        offerOutcome,
        sentiment,
        topics,
      };

      const updates = {
        displayName: name,
        notes,
      };

      const profile = await upsertCallerProfile(
        phoneNumber,
        callContext,
        updates,
        tenantId
      );

      return NextResponse.json({
        success: true,
        profile: {
          name: profile.displayName,
          phoneNumber: profile.phoneNumber,
          callCount: profile.callCount,
          relationshipScore: profile.relationshipScore,
          summary: profile.summary,
        },
        message: `Profile updated. Call count: ${profile.callCount}, Relationship score: ${profile.relationshipScore}/100`,
      });
    } catch (error: any) {
      console.error('[updateCallerMemory Error]:', error);
      return NextResponse.json(
        {
          error: error.message || 'Failed to update caller memory',
        },
        { status: 500 }
      );
    }
  });
}
