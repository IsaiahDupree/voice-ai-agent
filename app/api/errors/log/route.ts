/**
 * Error Logging API
 * Logs frontend errors from Error Boundary
 * Part of Feature F1288 (Error boundary in UI)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { error: errorData, errorInfo, section, timestamp, userAgent, url } = body;

    // Log error to database
    const { error: logError } = await supabase.from('ui_errors').insert({
      error_name: errorData?.name,
      error_message: errorData?.message,
      error_stack: errorData?.stack,
      component_stack: errorInfo?.componentStack,
      section,
      url,
      user_agent: userAgent,
      occurred_at: timestamp || new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    if (logError) {
      console.error('Failed to log UI error:', logError);
      return NextResponse.json(
        { error: 'Failed to log error' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in error logging endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
