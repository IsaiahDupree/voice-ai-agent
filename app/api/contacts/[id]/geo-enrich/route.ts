import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getPhoneGeoData } from '@/lib/phone-geo';

/**
 * F0142: Caller geographic data enrichment
 * POST /api/contacts/:id/geo-enrich
 *
 * Enriches contact record with geographic data derived from phone number
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contactId = params.id;

    // Get contact
    const { data: contact, error: fetchError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (fetchError) throw fetchError;

    if (!contact || !contact.phone) {
      return NextResponse.json(
        { error: 'Contact not found or has no phone number' },
        { status: 404 }
      );
    }

    // Get geo data from phone number
    const geoData = getPhoneGeoData(contact.phone);

    if (!geoData) {
      return NextResponse.json(
        { error: 'Unable to extract geographic data from phone number' },
        { status: 400 }
      );
    }

    // Update contact with geo data
    const { data: updatedContact, error: updateError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .update({
        metadata: {
          ...contact.metadata,
          geo: {
            area_code: geoData.areaCode,
            state: geoData.state,
            state_code: geoData.stateCode,
            city: geoData.city,
            region: geoData.region,
            timezone: geoData.timezone,
            country: geoData.country,
            country_code: geoData.countryCode,
            enriched_at: new Date().toISOString(),
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      contact_id: contactId,
      geo_data: geoData,
      contact: updatedContact,
    });
  } catch (error: any) {
    console.error('Error enriching contact with geo data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enrich contact' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/contacts/:id/geo-enrich
 * Preview geo data without saving
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contactId = params.id;

    const { data: contact, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('phone')
      .eq('id', contactId)
      .single();

    if (error) throw error;

    if (!contact || !contact.phone) {
      return NextResponse.json(
        { error: 'Contact not found or has no phone number' },
        { status: 404 }
      );
    }

    const geoData = getPhoneGeoData(contact.phone);

    return NextResponse.json({
      contact_id: contactId,
      phone: contact.phone,
      geo_data: geoData,
      preview: true,
    });
  } catch (error: any) {
    console.error('Error previewing geo data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preview geo data' },
      { status: 500 }
    );
  }
}
