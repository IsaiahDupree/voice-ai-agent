/**
 * Booking Transaction Handler
 * Handles partial booking failures with rollback
 * Feature: F1296 (Partial booking failure)
 */

import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin;

export interface BookingTransactionData {
  contactId: string;
  callId: string;
  eventTypeId: string;
  startTime: string;
  endTime: string;
  timezone: string;
  name: string;
  email: string;
  phone: string;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
  rolledBack?: boolean;
}

/**
 * Execute booking with automatic rollback on failure
 */
export async function executeBookingTransaction(
  data: BookingTransactionData
): Promise<BookingResult> {
  let crmUpdateId: string | null = null;

  try {
    // Step 1: Update CRM record with pending booking
    const crmResult = await updateCRMWithPendingBooking(data);
    if (!crmResult.success) {
      return {
        success: false,
        error: `CRM update failed: ${crmResult.error}`,
      };
    }
    crmUpdateId = crmResult.updateId!;

    // Step 2: Create booking in Cal.com
    const bookingResult = await createCalComBooking(data);
    if (!bookingResult.success) {
      // Rollback CRM update
      await rollbackCRMUpdate(crmUpdateId, data.contactId);
      return {
        success: false,
        error: `Booking failed: ${bookingResult.error}`,
        rolledBack: true,
      };
    }

    // Step 3: Confirm CRM update with booking ID
    await confirmCRMBooking(crmUpdateId, bookingResult.bookingId!, data.contactId);

    // Step 4: Log successful booking
    await logBookingSuccess(data.callId, bookingResult.bookingId!);

    return {
      success: true,
      bookingId: bookingResult.bookingId,
    };
  } catch (error) {
    // Rollback on any unexpected error
    if (crmUpdateId) {
      await rollbackCRMUpdate(crmUpdateId, data.contactId);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      rolledBack: !!crmUpdateId,
    };
  }
}

/**
 * Update CRM with pending booking
 */
async function updateCRMWithPendingBooking(
  data: BookingTransactionData
): Promise<{ success: boolean; updateId?: string; error?: string }> {
  try {
    const { data: update, error } = await supabase
      .from('crm_booking_updates')
      .insert({
        contact_id: data.contactId,
        call_id: data.callId,
        status: 'pending',
        booking_data: {
          event_type_id: data.eventTypeId,
          start_time: data.startTime,
          end_time: data.endTime,
          timezone: data.timezone,
        },
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !update) {
      return { success: false, error: error?.message || 'Failed to create CRM update' };
    }

    // Also update contact's metadata
    await supabase
      .from('contacts')
      .update({
        metadata: supabase.rpc('jsonb_set', {
          target: 'metadata',
          path: ['pending_booking'],
          value: JSON.stringify({
            update_id: update.id,
            start_time: data.startTime,
          }),
        }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.contactId);

    return { success: true, updateId: update.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create booking in Cal.com
 */
async function createCalComBooking(
  data: BookingTransactionData
): Promise<{ success: boolean; bookingId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.cal.com/v1/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CALCOM_API_KEY}`,
      },
      body: JSON.stringify({
        eventTypeId: parseInt(data.eventTypeId),
        start: data.startTime,
        responses: {
          name: data.name,
          email: data.email,
          phone: data.phone,
        },
        timeZone: data.timezone,
        metadata: {
          source: 'voice_ai_agent',
          call_id: data.callId,
          contact_id: data.contactId,
        },
      }),
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Cal.com API error ${response.status}: ${errorText}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      bookingId: String(result.id),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Confirm CRM booking with actual booking ID
 */
async function confirmCRMBooking(
  updateId: string,
  bookingId: string,
  contactId: string
): Promise<void> {
  // Update booking update record
  await supabase
    .from('crm_booking_updates')
    .update({
      status: 'confirmed',
      booking_id: bookingId,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', updateId);

  // Update contact record
  await supabase
    .from('contacts')
    .update({
      last_booking_id: bookingId,
      last_booking_at: new Date().toISOString(),
      metadata: supabase.rpc('jsonb_delete_path', {
        target: 'metadata',
        path: ['pending_booking'],
      }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId);
}

/**
 * Rollback CRM update on booking failure
 */
async function rollbackCRMUpdate(updateId: string, contactId: string): Promise<void> {
  console.log(`Rolling back CRM update ${updateId} for contact ${contactId}`);

  try {
    // Mark update as rolled back
    await supabase
      .from('crm_booking_updates')
      .update({
        status: 'rolled_back',
        rolled_back_at: new Date().toISOString(),
      })
      .eq('id', updateId);

    // Remove pending booking from contact metadata
    await supabase
      .from('contacts')
      .update({
        metadata: supabase.rpc('jsonb_delete_path', {
          target: 'metadata',
          path: ['pending_booking'],
        }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    console.log(`Successfully rolled back CRM update ${updateId}`);
  } catch (error) {
    console.error(`Failed to rollback CRM update:`, error);
    // Log rollback failure for manual intervention
    await supabase.from('rollback_failures').insert({
      update_id: updateId,
      contact_id: contactId,
      error_message: error instanceof Error ? error.message : String(error),
      failed_at: new Date().toISOString(),
    });
  }
}

/**
 * Log successful booking
 */
async function logBookingSuccess(callId: string, bookingId: string): Promise<void> {
  await supabase.from('call_logs').update({
    booking_id: bookingId,
    booking_status: 'confirmed',
    updated_at: new Date().toISOString(),
  }).eq('id', callId);

  await supabase.from('booking_log').insert({
    call_id: callId,
    booking_id: bookingId,
    status: 'success',
    created_at: new Date().toISOString(),
  });
}

/**
 * Get booking transaction history for debugging
 */
export async function getBookingTransactionHistory(
  contactId: string
): Promise<Array<{
  id: string;
  status: string;
  bookingId?: string;
  createdAt: string;
  confirmedAt?: string;
  rolledBackAt?: string;
}>> {
  const { data, error } = await supabase
    .from('crm_booking_updates')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch booking transaction history:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    status: row.status,
    bookingId: row.booking_id,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    rolledBackAt: row.rolled_back_at,
  }));
}
