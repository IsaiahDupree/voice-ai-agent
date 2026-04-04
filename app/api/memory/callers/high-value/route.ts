/**
 * GET /api/memory/callers/high-value
 * List high-value callers (relationship_score >= 70)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'default';
    const minScore = parseInt(searchParams.get('minScore') || '70');
    const limit = parseInt(searchParams.get('limit') || '100');

    const { data, error } = await supabaseAdmin
      .from('caller_memory')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('relationship_score', minScore)
      .order('relationship_score', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    const callers = (data || []).map((row) => ({
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

    return NextResponse.json({
      success: true,
      callers,
      count: callers.length,
      minScore,
    });
  } catch (error: any) {
    console.error('[List High-Value Callers Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to list high-value callers',
      },
      { status: 500 }
    );
  }
}
