/**
 * Event types library for Cal.com scheduling
 */

import { supabaseAdmin } from '@/lib/supabase'

export interface EventType {
  id: string
  name: string
  description?: string
  duration_minutes: number
  cal_com_id?: string
  org_id?: string
  created_at: string
  updated_at: string
}

/**
 * Get all event types for organization
 */
export async function getEventTypes(orgId: string): Promise<EventType[]> {
  const supabase = supabaseAdmin

  try {
    const { data, error } = await supabase
      .from('event_types')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching event types:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getEventTypes:', error)
    return []
  }
}

/**
 * Get event type by ID
 */
export async function getEventType(eventTypeId: string): Promise<EventType | null> {
  const supabase = supabaseAdmin

  try {
    const { data, error } = await supabase
      .from('event_types')
      .select('*')
      .eq('id', eventTypeId)
      .single()

    if (error) {
      console.error('Error fetching event type:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in getEventType:', error)
    return null
  }
}

/**
 * Create new event type
 */
export async function createEventType(
  eventType: Omit<EventType, 'id' | 'created_at' | 'updated_at'>
): Promise<EventType | null> {
  const supabase = supabaseAdmin

  try {
    const { data, error } = await supabase
      .from('event_types')
      .insert({
        ...eventType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating event type:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in createEventType:', error)
    return null
  }
}

/**
 * Update event type
 */
export async function updateEventType(
  eventTypeId: string,
  updates: Partial<Omit<EventType, 'id' | 'created_at'>>
): Promise<EventType | null> {
  const supabase = supabaseAdmin

  try {
    const { data, error } = await supabase
      .from('event_types')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventTypeId)
      .select()
      .single()

    if (error) {
      console.error('Error updating event type:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in updateEventType:', error)
    return null
  }
}

/**
 * Delete event type
 */
export async function deleteEventType(eventTypeId: string): Promise<boolean> {
  const supabase = supabaseAdmin

  try {
    const { error } = await supabase
      .from('event_types')
      .delete()
      .eq('id', eventTypeId)

    if (error) {
      console.error('Error deleting event type:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in deleteEventType:', error)
    return false
  }
}

/**
 * Validate event type
 */
export function validateEventType(
  eventType: Partial<EventType>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!eventType.name || eventType.name.trim() === '') {
    errors.push('Event type name is required')
  }

  if (!eventType.duration_minutes || eventType.duration_minutes < 1) {
    errors.push('Duration must be at least 1 minute')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
