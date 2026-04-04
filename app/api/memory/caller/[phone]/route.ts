/**
 * GET /api/memory/caller/:phone
 * Fetch caller profile by phone number
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCallerProfile } from '@/lib/caller-memory';

export async function GET(
  request: NextRequest,
  { params }: { params: { phone: string } }
) {
  try {
    const phoneNumber = decodeURIComponent(params.phone);
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'default';

    const profile = await getCallerProfile(phoneNumber, tenantId);

    if (!profile) {
      return NextResponse.json(
        { error: 'Caller profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error: any) {
    console.error('[Get Caller Profile Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch caller profile',
      },
      { status: 500 }
    );
  }
}
