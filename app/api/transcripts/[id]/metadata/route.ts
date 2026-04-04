// F0338: Booking duration in transcript - Add booking metadata to transcript

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * F0338: Get transcript with booking duration metadata
 * GET /api/transcripts/:id/metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Fetch transcript with call and booking data
    const { data: transcript, error } = await supabaseAdmin
      .from('voice_agent_transcripts')
      .select(`
        *,
        call:voice_agent_calls!inner(
          id,
          started_at,
          ended_at,
          duration_seconds,
          booking_made,
          bookings:bookings(
            id,
            title,
            start_time,
            end_time,
            duration_minutes,
            location,
            status,
            contact_id
          )
        )
      `)
      .eq('id', params.id)
      .single();

    if (error || !transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    // Calculate booking duration if booking was made
    const booking = transcript.call?.bookings?.[0];
    let bookingMetadata = null;

    if (booking) {
      const startTime = new Date(booking.start_time);
      const endTime = new Date(booking.end_time);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));

      bookingMetadata = {
        booking_id: booking.id,
        booking_title: booking.title,
        booking_start: booking.start_time,
        booking_end: booking.end_time,
        booking_duration_minutes: durationMinutes,
        booking_location: booking.location,
        booking_status: booking.status,
        contact_id: booking.contact_id,
        // Time from call start to booking created
        time_to_book_seconds: transcript.call?.duration_seconds || null,
      };
    }

    return NextResponse.json({
      success: true,
      transcript_id: transcript.id,
      call_id: transcript.call_id,
      call_duration_seconds: transcript.call?.duration_seconds,
      booking_made: transcript.call?.booking_made || false,
      booking_metadata: bookingMetadata,
      transcript_metadata: {
        word_count: transcript.word_count,
        speaker_count: transcript.speaker_count,
        sentiment: transcript.sentiment,
        topics: transcript.topics,
      },
    });
  } catch (error: any) {
    console.error('Error fetching transcript metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch metadata' },
      { status: 500 }
    );
  }
}

/**
 * F0338: Add or update booking duration metadata in transcript
 * PUT /api/transcripts/:id/metadata
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { booking_id, booking_duration_minutes } = body;

    if (!booking_id) {
      return NextResponse.json(
        { error: 'booking_id is required' },
        { status: 400 }
      );
    }

    // Fetch transcript
    const { data: transcript, error: fetchError } = await supabaseAdmin
      .from('voice_agent_transcripts')
      .select('metadata')
      .eq('id', params.id)
      .single();

    if (fetchError || !transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    // Update metadata with booking info
    const currentMetadata = transcript.metadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      booking_id,
      booking_duration_minutes,
      booking_metadata_added_at: new Date().toISOString(),
    };

    const { data, error: updateError } = await supabaseAdmin
      .from('voice_agent_transcripts')
      .update({ metadata: updatedMetadata })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      transcript_id: data.id,
      metadata: data.metadata,
      message: 'Booking metadata added to transcript',
    });
  } catch (error: any) {
    console.error('Error updating transcript metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update metadata' },
      { status: 500 }
    );
  }
}
