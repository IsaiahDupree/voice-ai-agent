import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0234: Contact priority scoring
 * Score and rank contacts to dial highest-priority leads first
 */

// GET /api/campaigns/:id/priority-scoring
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: campaign, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('id, name, metadata')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    const scoringConfig = campaign.metadata?.priority_scoring || {
      enabled: false,
      rules: [],
    };

    return NextResponse.json({
      campaign_id: params.id,
      priority_scoring: scoringConfig,
    });
  } catch (error: any) {
    console.error('Error fetching priority scoring:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch priority scoring' },
      { status: 500 }
    );
  }
}

// PUT /api/campaigns/:id/priority-scoring
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { enabled, rules } = body;

    if (enabled && (!rules || !Array.isArray(rules))) {
      return NextResponse.json(
        { error: 'rules array required when enabled' },
        { status: 400 }
      );
    }

    // Validate rules
    for (const rule of rules || []) {
      if (!rule.field || !rule.condition || rule.score === undefined) {
        return NextResponse.json(
          { error: 'Each rule must have field, condition, and score' },
          { status: 400 }
        );
      }
    }

    // Get existing campaign
    const { data: campaign } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('metadata')
      .eq('id', params.id)
      .single();

    // Update with priority scoring config
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .update({
        metadata: {
          ...campaign?.metadata,
          priority_scoring: {
            enabled: enabled !== false,
            rules: rules || [],
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // Recalculate scores for all contacts if enabled
    if (enabled && rules && rules.length > 0) {
      await recalculateContactScores(params.id, rules);
    }

    return NextResponse.json({
      success: true,
      campaign_id: params.id,
      priority_scoring: data.metadata.priority_scoring,
    });
  } catch (error: any) {
    console.error('Error updating priority scoring:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update priority scoring' },
      { status: 500 }
    );
  }
}

async function recalculateContactScores(
  campaignId: string,
  rules: Array<{ field: string; condition: string; value: any; score: number }>
) {
  // Get all campaign contacts
  const { data: campaignContacts } = await supabaseAdmin
    .from('voice_agent_campaign_contacts')
    .select('id, contact_id, metadata')
    .eq('campaign_id', campaignId);

  if (!campaignContacts) return;

  // Get contact details
  const contactIds = campaignContacts.map((cc) => cc.contact_id);
  const { data: contacts } = await supabaseAdmin
    .from('voice_agent_contacts')
    .select('*')
    .in('id', contactIds);

  if (!contacts) return;

  // Score each contact
  for (const campaignContact of campaignContacts) {
    const contact = contacts.find((c) => c.id === campaignContact.contact_id);
    if (!contact) continue;

    let totalScore = 0;

    for (const rule of rules) {
      const fieldValue = getFieldValue(contact, rule.field);

      if (evaluateCondition(fieldValue, rule.condition, rule.value)) {
        totalScore += rule.score;
      }
    }

    // Update contact with score
    await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .update({
        metadata: {
          ...campaignContact.metadata,
          priority_score: totalScore,
        },
      })
      .eq('id', campaignContact.id);
  }
}

function getFieldValue(contact: any, field: string): any {
  // Handle nested fields (e.g., "metadata.industry")
  const parts = field.split('.');
  let value = contact;

  for (const part of parts) {
    value = value?.[part];
  }

  return value;
}

function evaluateCondition(value: any, condition: string, target: any): boolean {
  switch (condition) {
    case 'equals':
      return value === target;
    case 'not_equals':
      return value !== target;
    case 'contains':
      return String(value).includes(target);
    case 'greater_than':
      return Number(value) > Number(target);
    case 'less_than':
      return Number(value) < Number(target);
    case 'exists':
      return value !== null && value !== undefined;
    case 'not_exists':
      return value === null || value === undefined;
    default:
      return false;
  }
}

/**
 * Example priority rules:
 * [
 *   { "field": "metadata.deal_size", "condition": "greater_than", "value": 50000, "score": 100 },
 *   { "field": "metadata.industry", "condition": "equals", "value": "SaaS", "score": 50 },
 *   { "field": "metadata.referral", "condition": "exists", "score": 75 }
 * ]
 */
