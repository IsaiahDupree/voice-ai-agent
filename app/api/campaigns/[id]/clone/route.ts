import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0221: Campaign clone
 * POST /api/campaigns/:id/clone
 *
 * Clones an existing campaign with all settings and contacts
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sourceCampaignId = params.id;
    const body = await request.json();
    const { name, include_contacts } = body;

    // Get source campaign
    const { data: sourceCampaign, error: fetchError } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('*')
      .eq('id', sourceCampaignId)
      .single();

    if (fetchError) throw fetchError;

    // Create new campaign with cloned settings
    const { data: newCampaign, error: createError } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .insert({
        name: name || `${sourceCampaign.name} (Copy)`,
        assistant_id: sourceCampaign.assistant_id,
        status: 'draft', // Always start as draft
        schedule: sourceCampaign.schedule,
        calling_window: sourceCampaign.calling_window,
        max_calls_per_day: sourceCampaign.max_calls_per_day,
        voicemail_message: sourceCampaign.voicemail_message,
        metadata: {
          ...sourceCampaign.metadata,
          cloned_from: sourceCampaignId,
          cloned_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) throw createError;

    let contactsCloned = 0;

    // Clone contacts if requested
    if (include_contacts !== false) {
      const { data: sourceContacts, error: contactsError } = await supabaseAdmin
        .from('voice_agent_campaign_contacts')
        .select('contact_id, metadata')
        .eq('campaign_id', sourceCampaignId);

      if (contactsError) throw contactsError;

      if (sourceContacts && sourceContacts.length > 0) {
        const contactsToInsert = sourceContacts.map((sc) => ({
          campaign_id: newCampaign.id,
          contact_id: sc.contact_id,
          status: 'pending',
          attempts: 0,
          metadata: sc.metadata,
          created_at: new Date().toISOString(),
        }));

        const { error: insertError } = await supabaseAdmin
          .from('voice_agent_campaign_contacts')
          .insert(contactsToInsert);

        if (insertError) throw insertError;

        contactsCloned = contactsToInsert.length;
      }
    }

    return NextResponse.json({
      success: true,
      source_campaign_id: sourceCampaignId,
      new_campaign: {
        id: newCampaign.id,
        name: newCampaign.name,
        status: newCampaign.status,
      },
      contacts_cloned: contactsCloned,
    });
  } catch (error: any) {
    console.error('Error cloning campaign:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clone campaign' },
      { status: 500 }
    );
  }
}
