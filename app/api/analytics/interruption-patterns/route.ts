/**
 * GET /api/analytics/interruption-patterns
 * Analytics endpoint for semantic VAD interruption classification patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assistantId = searchParams.get('assistantId');
    const timeRange = searchParams.get('timeRange') || '7d'; // 7d, 30d, 90d
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Calculate time range
    const now = new Date();
    const rangeMap: Record<string, number> = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };
    const days = rangeMap[timeRange] || 7;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Base query
    let query = supabaseAdmin
      .from('speech_classifications')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by assistant if provided
    if (assistantId) {
      query = query.eq('assistant_id', assistantId);
    }

    const { data: classifications, error } = await query;

    if (error) {
      throw error;
    }

    // Aggregate statistics
    const total = classifications?.length || 0;
    const byType: Record<string, number> = {
      'real-interrupt': 0,
      'filler': 0,
      'affirmation': 0,
      'side-comment': 0,
    };
    const pauseTriggered = classifications?.filter((c) => c.pause_triggered).length || 0;
    const avgConfidence =
      classifications?.reduce((sum, c) => sum + Number(c.confidence), 0) / total || 0;

    classifications?.forEach((c) => {
      byType[c.classification_type] = (byType[c.classification_type] || 0) + 1;
    });

    // False positive analysis: affirmations/fillers that triggered pause
    const falsePositives = classifications?.filter(
      (c) =>
        (c.classification_type === 'affirmation' ||
          c.classification_type === 'filler') &&
        c.pause_triggered
    ).length || 0;

    // False negative estimation: real-interrupts that didn't trigger pause
    const falseNegatives = classifications?.filter(
      (c) => c.classification_type === 'real-interrupt' && !c.pause_triggered
    ).length || 0;

    // Top utterances by type
    const utteranceCounts: Record<string, number> = {};
    classifications?.forEach((c) => {
      const key = c.utterance.toLowerCase().trim();
      utteranceCounts[key] = (utteranceCounts[key] || 0) + 1;
    });

    const topUtterances = Object.entries(utteranceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([utterance, count]) => ({ utterance, count }));

    // Time series data (by day)
    const timeSeriesMap: Record<string, any> = {};
    classifications?.forEach((c) => {
      const day = c.created_at.split('T')[0]; // YYYY-MM-DD
      if (!timeSeriesMap[day]) {
        timeSeriesMap[day] = {
          date: day,
          total: 0,
          realInterrupts: 0,
          fillers: 0,
          affirmations: 0,
          sideComments: 0,
          pausesTriggered: 0,
        };
      }
      timeSeriesMap[day].total++;
      if (c.classification_type === 'real-interrupt') timeSeriesMap[day].realInterrupts++;
      if (c.classification_type === 'filler') timeSeriesMap[day].fillers++;
      if (c.classification_type === 'affirmation') timeSeriesMap[day].affirmations++;
      if (c.classification_type === 'side-comment') timeSeriesMap[day].sideComments++;
      if (c.pause_triggered) timeSeriesMap[day].pausesTriggered++;
    });

    const timeSeries = Object.values(timeSeriesMap).sort((a: any, b: any) =>
      a.date.localeCompare(b.date)
    );

    return NextResponse.json({
      timeRange,
      assistantId: assistantId || 'all',
      summary: {
        total,
        pauseTriggered,
        pauseRate: total > 0 ? (pauseTriggered / total) * 100 : 0,
        avgConfidence: avgConfidence.toFixed(2),
        byType,
        falsePositives,
        falseNegatives,
        falsePositiveRate: total > 0 ? (falsePositives / total) * 100 : 0,
      },
      topUtterances,
      timeSeries,
      recentClassifications: classifications?.slice(0, 10).map((c) => ({
        utterance: c.utterance,
        type: c.classification_type,
        confidence: c.confidence,
        pauseTriggered: c.pause_triggered,
        agentSpeaking: c.agent_speaking,
        createdAt: c.created_at,
      })),
    });
  } catch (error: any) {
    console.error('[Interruption Patterns Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch interruption patterns',
      },
      { status: 500 }
    );
  }
}
