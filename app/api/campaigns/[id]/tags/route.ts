import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0238: Campaign tag system
 * Add tags to campaigns for organization and filtering
 */

// GET /api/campaigns/:id/tags
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

    const tags = campaign.metadata?.tags || [];

    return NextResponse.json({
      campaign_id: params.id,
      campaign_name: campaign.name,
      tags,
    });
  } catch (error: any) {
    console.error('Error fetching campaign tags:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch campaign tags' },
      { status: 500 }
    );
  }
}

// POST /api/campaigns/:id/tags - Add tags
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { tags } = body;

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { error: 'tags array is required' },
        { status: 400 }
      );
    }

    // Get existing campaign
    const { data: campaign } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('metadata')
      .eq('id', params.id)
      .single();

    const existingTags = campaign?.metadata?.tags || [];
    const mergedTags = Array.from(new Set([...existingTags, ...tags]));

    // Update with tags
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .update({
        metadata: {
          ...campaign?.metadata,
          tags: mergedTags,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      campaign_id: params.id,
      tags: data.metadata.tags,
    });
  } catch (error: any) {
    console.error('Error adding campaign tags:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add campaign tags' },
      { status: 500 }
    );
  }
}

// DELETE /api/campaigns/:id/tags - Remove tags
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tagsToRemove = searchParams.get('tags')?.split(',') || [];

    if (tagsToRemove.length === 0) {
      return NextResponse.json(
        { error: 'tags query parameter required (comma-separated)' },
        { status: 400 }
      );
    }

    // Get existing campaign
    const { data: campaign } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('metadata')
      .eq('id', params.id)
      .single();

    const existingTags = campaign?.metadata?.tags || [];
    const updatedTags = existingTags.filter((t: string) => !tagsToRemove.includes(t));

    // Update with filtered tags
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .update({
        metadata: {
          ...campaign?.metadata,
          tags: updatedTags,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      campaign_id: params.id,
      tags: data.metadata.tags,
    });
  } catch (error: any) {
    console.error('Error removing campaign tags:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove campaign tags' },
      { status: 500 }
    );
  }
}
