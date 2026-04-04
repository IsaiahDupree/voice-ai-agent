/**
 * POST /api/memory/caller
 * Create or update caller profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { upsertCallerProfile } from '@/lib/caller-memory';

export async function POST(request: NextRequest) {
  try {
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
      preferences,
      metadata,
      tenantId = 'default',
    } = body;

    if (!phoneNumber || !callId) {
      return NextResponse.json(
        { error: 'phoneNumber and callId are required' },
        { status: 400 }
      );
    }

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
      preferences,
      metadata,
    };

    const profile = await upsertCallerProfile(
      phoneNumber,
      callContext,
      updates,
      tenantId
    );

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error: any) {
    console.error('[Upsert Caller Profile Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to create/update caller profile',
      },
      { status: 500 }
    );
  }
}
