/**
 * POST /api/dtmf/validate
 *
 * Validate DTMF input (PIN, account number, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { DTMFRouter } from '@/lib/dtmf-router';

/**
 * POST /api/dtmf/validate
 * Validate collected DTMF input
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input, type, length, min_length, max_length } = body;

    if (!input || !type) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['input', 'type'],
        },
        { status: 400 }
      );
    }

    const validation = DTMFRouter.validateInput(input, type, {
      length,
      min_length,
      max_length,
    });

    return NextResponse.json({
      success: true,
      valid: validation.valid,
      error: validation.error,
      input,
      type,
    });
  } catch (error: unknown) {
    console.error('[/api/dtmf/validate] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dtmf/validate
 * Health check and validation rules documentation
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'dtmf-validation',
    supported_types: {
      account_number: {
        description: 'Account numbers (8-16 digits)',
        pattern: '^\\d{8,16}$',
      },
      pin: {
        description: 'PIN codes (4-8 digits)',
        pattern: '^\\d{4,8}$',
      },
      numeric: {
        description: 'Generic numeric input',
        pattern: '^\\d+$',
      },
      confirmation: {
        description: 'Confirmation input (1=yes, 2=no)',
        pattern: '^[12]$',
      },
    },
    examples: [
      {
        input: '1234567890',
        type: 'account_number',
        valid: true,
      },
      {
        input: '5678',
        type: 'pin',
        valid: true,
      },
      {
        input: '1',
        type: 'confirmation',
        valid: true,
      },
    ],
  });
}
