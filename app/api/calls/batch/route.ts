// F1001: POST /api/calls/batch - batch call initiation for campaigns

import { NextRequest } from 'next/server'
import { startCall } from '@/lib/vapi'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

interface BatchCallRequest {
  assistantId: string
  phoneNumberId: string
  contacts: Array<{
    phone: string
    metadata?: Record<string, any>
  }>
  assistantOverrides?: Record<string, any>
  delayBetweenCalls?: number // ms delay between calls (default: 2000)
  maxConcurrent?: number // max concurrent calls (default: 1)
}

export async function POST(request: NextRequest) {
  try {
    const body: BatchCallRequest = await request.json()
    const {
      assistantId,
      phoneNumberId,
      contacts,
      assistantOverrides,
      delayBetweenCalls = 2000,
      maxConcurrent = 1,
    } = body

    // Validation
    if (!assistantId || !phoneNumberId || !contacts || contacts.length === 0) {
      return apiError(
        ErrorCodes.BAD_REQUEST,
        'Missing required fields: assistantId, phoneNumberId, and contacts array',
        400
      )
    }

    if (contacts.length > 100) {
      return apiError(
        ErrorCodes.BAD_REQUEST,
        'Maximum 100 contacts per batch. Use campaign API for larger batches.',
        400
      )
    }

    const supabase = supabaseAdmin
    const results: Array<{
      phone: string
      success: boolean
      callId?: string
      error?: string
    }> = []

    // Process calls in batches based on maxConcurrent
    for (let i = 0; i < contacts.length; i += maxConcurrent) {
      const batch = contacts.slice(i, i + maxConcurrent)

      const batchPromises = batch.map(async (contact) => {
        try {
          // Check if contact opted out
          const { data: existingContact } = await supabase
            .from('contacts')
            .select('opted_out')
            .eq('phone', contact.phone)
            .single()

          if (existingContact?.opted_out) {
            return {
              phone: contact.phone,
              success: false,
              error: 'Contact opted out',
            }
          }

          // Initiate call
          const call = await startCall({
            assistantId,
            phoneNumberId,
            customerNumber: contact.phone,
            assistantOverrides,
            metadata: {
              ...contact.metadata,
              batch_call: true,
              batch_timestamp: new Date().toISOString(),
            },
          })

          return {
            phone: contact.phone,
            success: true,
            callId: call.id,
          }
        } catch (error: any) {
          console.error(`Failed to call ${contact.phone}:`, error)
          return {
            phone: contact.phone,
            success: false,
            error: error.message || 'Unknown error',
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Delay between batches (except last batch)
      if (i + maxConcurrent < contacts.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenCalls))
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    return apiSuccess({
      total: contacts.length,
      success: successCount,
      failed: failureCount,
      results,
    })
  } catch (error: any) {
    console.error('Batch call error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to process batch calls: ${error.message}`,
      500
    )
  }
}
