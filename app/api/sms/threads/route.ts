// F0544: SMS conversation threads - list and manage SMS threads

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  apiSuccess,
  apiPaginated,
  apiError,
  ErrorCodes,
  parsePaginationParams,
} from '@/lib/api-response'
import { buildSupabaseQuery } from '@/lib/api-helpers'

/**
 * F0544: List SMS conversation threads
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const supabase = supabaseAdmin
    const { page, pageSize, offset } = parsePaginationParams(searchParams)

    const baseQuery = supabase
      .from('sms_threads')
      .select('*, contacts!inner(*), sms_messages(count)', { count: 'exact' })
      .range(offset, offset + pageSize - 1)

    const query = buildSupabaseQuery(baseQuery, searchParams, {
      defaultSort: { column: 'last_message_at', direction: 'desc' },
      allowedSortColumns: ['created_at', 'last_message_at', 'status'],
      allowedFilterColumns: ['status', 'contact_id', 'from_number'],
    })

    const { data: threads, error, count } = await query

    if (error) {
      return apiError(ErrorCodes.DATABASE_ERROR, `Failed to fetch threads: ${error.message}`, 500)
    }

    return apiPaginated(threads || [], page, pageSize, count || 0)
  } catch (error: any) {
    console.error('SMS threads fetch error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to fetch SMS threads: ${error.message}`,
      500
    )
  }
}
