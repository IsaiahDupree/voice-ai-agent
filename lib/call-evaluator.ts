/**
 * Call Evaluator - LLM-as-Judge
 *
 * Uses GPT-4o to automatically evaluate every call for quality, goal achievement,
 * and areas for improvement. Produces structured feedback for rapid iteration.
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CallEvaluation {
  call_id: string;
  goal_achieved: boolean;
  goal_achievement_score: number; // 0-10
  naturalness_score: number; // 0-10
  objection_handling_score: number; // 0-10
  information_accuracy_score: number; // 0-10
  overall_score: number; // 0-10
  failure_points: string[];
  improvement_suggestions: string[];
  highlight_moments: string[];
  recommended_prompt_changes: string[];
  evaluation_data?: Record<string, unknown>;
}

export interface CallContext {
  call_id: string;
  transcript: string;
  goal: string; // What was the agent supposed to achieve?
  call_duration_seconds?: number;
  outcome?: string; // booked, transferred, voicemail, etc.
  customer_sentiment?: string;
  tenant_id?: string;
}

/**
 * Evaluate a call using GPT-4o as judge
 * Returns structured quality scores and actionable feedback
 */
export async function evaluateCall(context: CallContext): Promise<CallEvaluation> {
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert call quality analyst. Your job is to evaluate AI voice assistant calls and provide actionable feedback.

Analyze the conversation transcript and determine:
1. Did the agent achieve the stated goal?
2. How natural and human-like was the conversation?
3. How well did the agent handle objections or questions?
4. Was the information provided accurate and helpful?
5. What specific moments went wrong?
6. What should be improved for next time?

Respond ONLY with a JSON object in this exact format:
{
  "goal_achieved": boolean,
  "goal_achievement_score": number (0-10),
  "naturalness_score": number (0-10),
  "objection_handling_score": number (0-10),
  "information_accuracy_score": number (0-10),
  "overall_score": number (0-10, average of above scores),
  "failure_points": ["exact moment 1 with timestamp if available", "exact moment 2", ...],
  "improvement_suggestions": ["specific suggestion 1", "specific suggestion 2", ...],
  "highlight_moments": ["thing agent did well 1", "thing agent did well 2", ...],
  "recommended_prompt_changes": ["prompt change 1", "prompt change 2", ...]
}

Be critical but constructive. Focus on specific, actionable feedback.`,
        },
        {
          role: 'user',
          content: `Call Goal: ${context.goal}

Transcript:
${context.transcript}

${context.outcome ? `\nOutcome: ${context.outcome}` : ''}
${context.call_duration_seconds ? `\nCall Duration: ${context.call_duration_seconds}s` : ''}
${context.customer_sentiment ? `\nCustomer Sentiment: ${context.customer_sentiment}` : ''}

Evaluate this call and provide detailed feedback.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent evaluations
      max_tokens: 2000,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    // Ensure all arrays exist
    const evaluation: CallEvaluation = {
      call_id: context.call_id,
      goal_achieved: result.goal_achieved ?? false,
      goal_achievement_score: Math.min(10, Math.max(0, result.goal_achievement_score ?? 0)),
      naturalness_score: Math.min(10, Math.max(0, result.naturalness_score ?? 0)),
      objection_handling_score: Math.min(10, Math.max(0, result.objection_handling_score ?? 0)),
      information_accuracy_score: Math.min(10, Math.max(0, result.information_accuracy_score ?? 0)),
      overall_score: Math.min(10, Math.max(0, result.overall_score ?? 0)),
      failure_points: result.failure_points || [],
      improvement_suggestions: result.improvement_suggestions || [],
      highlight_moments: result.highlight_moments || [],
      recommended_prompt_changes: result.recommended_prompt_changes || [],
      evaluation_data: result,
    };

    const duration = Date.now() - startTime;

    // Store evaluation in database
    await supabase.from('call_evaluations').upsert(
      {
        call_id: context.call_id,
        tenant_id: context.tenant_id || 'default',
        goal_achieved: evaluation.goal_achieved,
        goal_achievement_score: evaluation.goal_achievement_score,
        naturalness_score: evaluation.naturalness_score,
        objection_handling_score: evaluation.objection_handling_score,
        information_accuracy_score: evaluation.information_accuracy_score,
        overall_score: evaluation.overall_score,
        failure_points: evaluation.failure_points,
        improvement_suggestions: evaluation.improvement_suggestions,
        highlight_moments: evaluation.highlight_moments,
        recommended_prompt_changes: evaluation.recommended_prompt_changes,
        evaluation_data: result,
        evaluator_model: 'gpt-4o',
        evaluation_duration_ms: duration,
        transcript_length: context.transcript.length,
        call_duration_seconds: context.call_duration_seconds,
      },
      { onConflict: 'call_id' }
    );

    console.log(`[CallEvaluator] Evaluated call ${context.call_id}: overall score ${evaluation.overall_score}/10`);

    return evaluation;
  } catch (error) {
    console.error('[CallEvaluator] Evaluation failed:', error);
    throw error;
  }
}

/**
 * Batch evaluate multiple calls
 */
export async function evaluateCallBatch(contexts: CallContext[]): Promise<CallEvaluation[]> {
  const results = await Promise.allSettled(contexts.map((ctx) => evaluateCall(ctx)));

  return results
    .filter((r): r is PromiseFulfilledResult<CallEvaluation> => r.status === 'fulfilled')
    .map((r) => r.value);
}

/**
 * Get evaluation for a specific call
 */
export async function getEvaluation(callId: string): Promise<CallEvaluation | null> {
  const { data, error } = await supabase
    .from('call_evaluations')
    .select('*')
    .eq('call_id', callId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    call_id: data.call_id,
    goal_achieved: data.goal_achieved,
    goal_achievement_score: data.goal_achievement_score,
    naturalness_score: data.naturalness_score,
    objection_handling_score: data.objection_handling_score,
    information_accuracy_score: data.information_accuracy_score,
    overall_score: data.overall_score,
    failure_points: data.failure_points || [],
    improvement_suggestions: data.improvement_suggestions || [],
    highlight_moments: data.highlight_moments || [],
    recommended_prompt_changes: data.recommended_prompt_changes || [],
    evaluation_data: data.evaluation_data,
  };
}

/**
 * Get aggregate evaluation statistics
 */
export async function getAggregateStats(
  tenantId: string = 'default',
  startDate?: Date,
  endDate?: Date
): Promise<{
  total_evaluations: number;
  average_overall_score: number;
  average_goal_achievement_score: number;
  average_naturalness_score: number;
  average_objection_handling_score: number;
  average_information_accuracy_score: number;
  goal_achievement_rate: number;
  common_failure_points: string[];
  top_improvement_suggestions: string[];
}> {
  let query = supabase.from('call_evaluations').select('*').eq('tenant_id', tenantId);

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return {
      total_evaluations: 0,
      average_overall_score: 0,
      average_goal_achievement_score: 0,
      average_naturalness_score: 0,
      average_objection_handling_score: 0,
      average_information_accuracy_score: 0,
      goal_achievement_rate: 0,
      common_failure_points: [],
      top_improvement_suggestions: [],
    };
  }

  const total = data.length;
  const goalsAchieved = data.filter((d) => d.goal_achieved).length;

  // Calculate averages
  const avgOverall = data.reduce((sum, d) => sum + (d.overall_score || 0), 0) / total;
  const avgGoal = data.reduce((sum, d) => sum + (d.goal_achievement_score || 0), 0) / total;
  const avgNaturalness = data.reduce((sum, d) => sum + (d.naturalness_score || 0), 0) / total;
  const avgObjection = data.reduce((sum, d) => sum + (d.objection_handling_score || 0), 0) / total;
  const avgInfo = data.reduce((sum, d) => sum + (d.information_accuracy_score || 0), 0) / total;

  // Aggregate failure points and suggestions
  const failurePointsMap = new Map<string, number>();
  const suggestionsMap = new Map<string, number>();

  data.forEach((evaluation) => {
    (evaluation.failure_points || []).forEach((fp: string) => {
      failurePointsMap.set(fp, (failurePointsMap.get(fp) || 0) + 1);
    });
    (evaluation.improvement_suggestions || []).forEach((s: string) => {
      suggestionsMap.set(s, (suggestionsMap.get(s) || 0) + 1);
    });
  });

  const commonFailures = Array.from(failurePointsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([fp]) => fp);

  const topSuggestions = Array.from(suggestionsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([s]) => s);

  return {
    total_evaluations: total,
    average_overall_score: Math.round(avgOverall * 10) / 10,
    average_goal_achievement_score: Math.round(avgGoal * 10) / 10,
    average_naturalness_score: Math.round(avgNaturalness * 10) / 10,
    average_objection_handling_score: Math.round(avgObjection * 10) / 10,
    average_information_accuracy_score: Math.round(avgInfo * 10) / 10,
    goal_achievement_rate: Math.round((goalsAchieved / total) * 100),
    common_failure_points: commonFailures,
    top_improvement_suggestions: topSuggestions,
  };
}

/**
 * Get all failing calls (below threshold)
 */
export async function getFailingCalls(
  threshold: number = 5.0,
  tenantId: string = 'default',
  limit: number = 50
): Promise<CallEvaluation[]> {
  const { data, error } = await supabase
    .from('call_evaluations')
    .select('*')
    .eq('tenant_id', tenantId)
    .lt('overall_score', threshold)
    .order('overall_score', { ascending: true })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((d) => ({
    call_id: d.call_id,
    goal_achieved: d.goal_achieved,
    goal_achievement_score: d.goal_achievement_score,
    naturalness_score: d.naturalness_score,
    objection_handling_score: d.objection_handling_score,
    information_accuracy_score: d.information_accuracy_score,
    overall_score: d.overall_score,
    failure_points: d.failure_points || [],
    improvement_suggestions: d.improvement_suggestions || [],
    highlight_moments: d.highlight_moments || [],
    recommended_prompt_changes: d.recommended_prompt_changes || [],
    evaluation_data: d.evaluation_data,
  }));
}
