import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { findNearestAssistant, getPhoneGeoData } from '@/lib/phone-geo';

/**
 * F0143: Multi-location routing
 * POST /api/routing/geo
 *
 * Routes caller to nearest assistant based on area code
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone_number } = body;

    if (!phone_number) {
      return NextResponse.json(
        { error: 'phone_number is required' },
        { status: 400 }
      );
    }

    // Get geo data for caller
    const geoData = getPhoneGeoData(phone_number);

    if (!geoData) {
      return NextResponse.json(
        { error: 'Unable to extract geographic data from phone number' },
        { status: 400 }
      );
    }

    // Get all assistants with location config
    const { data: personas, error } = await supabaseAdmin
      .from('personas')
      .select('id, name, metadata')
      .eq('enabled', true);

    if (error) throw error;

    // Build assistant location map from metadata
    const assistantLocations = personas
      .filter((p) => p.metadata?.location)
      .map((p) => ({
        assistantId: p.id,
        name: p.name,
        stateCode: p.metadata.location.state_code,
        region: p.metadata.location.region,
      }));

    if (assistantLocations.length === 0) {
      return NextResponse.json(
        {
          error: 'No assistants configured with location data',
          geo_data: geoData,
        },
        { status: 404 }
      );
    }

    // Find nearest assistant
    const nearestAssistantId = await findNearestAssistant(
      phone_number,
      assistantLocations
    );

    if (!nearestAssistantId) {
      // Return default assistant if no match
      const defaultAssistant = personas.find((p) => p.metadata?.is_default);

      return NextResponse.json({
        success: true,
        phone_number,
        geo_data: geoData,
        assistant_id: defaultAssistant?.id || personas[0]?.id,
        match_type: 'default',
        message: 'No location match found, using default assistant',
      });
    }

    const matchedAssistant = personas.find((p) => p.id === nearestAssistantId);

    return NextResponse.json({
      success: true,
      phone_number,
      geo_data: geoData,
      assistant_id: nearestAssistantId,
      assistant_name: matchedAssistant?.name,
      match_type: geoData.stateCode
        ? assistantLocations.find((a) => a.assistantId === nearestAssistantId)
            ?.stateCode === geoData.stateCode
          ? 'state'
          : 'region'
        : 'default',
    });
  } catch (error: any) {
    console.error('Error routing by geography:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to route by geography' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/routing/geo?phone=+1234567890
 * Preview routing decision without making a call
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: 'phone query parameter required' },
        { status: 400 }
      );
    }

    // Reuse POST logic
    return POST(
      new NextRequest(request.url, {
        method: 'POST',
        body: JSON.stringify({ phone_number: phone }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch (error: any) {
    console.error('Error previewing geo routing:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preview routing' },
      { status: 500 }
    );
  }
}
