/**
 * POST /api/tools/getCallerMemory
 * Vapi function tool to fetch caller profile at call start
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCallerProfile, formatCallerContext } from '@/lib/caller-memory';
import { withTelemetry } from '@/lib/tool-telemetry';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { phoneNumber, tenantId = 'default' } = body;

  return withTelemetry('getCallerMemory', body.callId, body, async () => {
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'phoneNumber is required' },
        { status: 400 }
      );
    }

    try {
      const profile = await getCallerProfile(phoneNumber, tenantId);

      if (!profile) {
        return NextResponse.json({
          found: false,
          message: 'This is a new caller.',
          phoneNumber,
        });
      }

      // Format context for agent
      const context = formatCallerContext(profile);

      return NextResponse.json({
        found: true,
        profile: {
          name: profile.displayName,
          phoneNumber: profile.phoneNumber,
          callCount: profile.callCount,
          firstCallDate: profile.firstCallAt,
          lastCallDate: profile.lastCallAt,
          relationshipScore: profile.relationshipScore,
          lastOffer: profile.lastOfferMade,
          lastOfferOutcome: profile.lastOfferOutcome,
        },
        context,
        summary: profile.summary,
      });
    } catch (error: any) {
      console.error('[getCallerMemory Error]:', error);
      return NextResponse.json(
        {
          error: error.message || 'Failed to fetch caller memory',
        },
        { status: 500 }
      );
    }
  });
}
