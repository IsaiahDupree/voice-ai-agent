// F0585: Contact import CSV - POST /api/contacts/import uploads CSV
// F0586: Contact export CSV - GET /api/contacts/export downloads CSV

import { supabaseAdmin } from './supabase'

export interface ImportResult {
  totalRows: number
  importedRows: number
  failedRows: number
  errors: Array<{ row: number; error: string }>
  importLogId: string
}

/**
 * F0585: Parse and import contacts from CSV
 * Expected columns: phone, name, email, company, notes
 */
export async function importContactsFromCSV(
  csvContent: string,
  options: {
    upsert?: boolean // Update existing contacts if phone matches
    skipHeader?: boolean
    importedBy?: string
  } = {}
): Promise<ImportResult> {
  const upsert = options.upsert ?? true
  const skipHeader = options.skipHeader ?? true
  const importedBy = options.importedBy || 'system'

  console.log('[Contact Import] Starting CSV import...')

  const lines = csvContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    throw new Error('CSV file is empty')
  }

  let startIndex = 0

  // Skip header row if needed
  if (skipHeader) {
    startIndex = 1
  }

  const dataRows = lines.slice(startIndex)
  const totalRows = dataRows.length

  let importedRows = 0
  let failedRows = 0
  const errors: Array<{ row: number; error: string }> = []

  for (let i = 0; i < dataRows.length; i++) {
    const rowIndex = startIndex + i + 1 // 1-indexed for user-friendly errors
    const row = dataRows[i]

    try {
      // Parse CSV row (simple comma split - doesn't handle quoted commas)
      const columns = row.split(',').map((col) => col.trim())

      if (columns.length < 1) {
        throw new Error('Row has no data')
      }

      // Expected format: phone, name, email, company, notes
      const [phone, name, email, company, notes] = columns

      if (!phone) {
        throw new Error('Phone number is required')
      }

      // Normalize phone (remove non-digits, ensure E.164 format)
      const normalizedPhone = normalizePhoneForImport(phone)

      // Prepare contact data
      const contactData: any = {
        phone: normalizedPhone,
        name: name || null,
        email: email || null,
        company: company || null,
        notes: notes || null,
        source: 'import',
      }

      // Insert or update
      if (upsert) {
        const { error } = await supabaseAdmin
          .from('voice_agent_contacts')
          .upsert(contactData, { onConflict: 'phone' })

        if (error) {
          throw error
        }
      } else {
        const { error } = await supabaseAdmin.from('voice_agent_contacts').insert(contactData)

        if (error) {
          throw error
        }
      }

      importedRows++
    } catch (error: any) {
      console.error(`[Contact Import] Error on row ${rowIndex}:`, error)
      errors.push({
        row: rowIndex,
        error: error.message || 'Unknown error',
      })
      failedRows++
    }
  }

  // Log import to audit table
  const { data: importLog } = await supabaseAdmin
    .from('voice_agent_contact_import_log')
    .insert({
      filename: 'upload.csv',
      source: 'csv',
      total_rows: totalRows,
      imported_rows: importedRows,
      failed_rows: failedRows,
      errors: errors,
      imported_by: importedBy,
    })
    .select('id')
    .single()

  console.log(
    `[Contact Import] Complete: ${importedRows}/${totalRows} imported, ${failedRows} failed`
  )

  return {
    totalRows,
    importedRows,
    failedRows,
    errors,
    importLogId: importLog?.id || '',
  }
}

/**
 * F0586: Export contacts to CSV format
 * Returns CSV string with all fields
 */
export async function exportContactsToCSV(options: {
  campaignId?: number
  contactIds?: number[]
  includeOptedOut?: boolean
} = {}): Promise<string> {
  console.log('[Contact Export] Starting CSV export...')

  try {
    let query = supabaseAdmin.from('voice_agent_contacts').select('*')

    // Apply filters
    if (options.contactIds && options.contactIds.length > 0) {
      query = query.in('id', options.contactIds)
    }

    if (options.campaignId) {
      // Get contact IDs from campaign
      const { data: campaignContacts } = await supabaseAdmin
        .from('voice_agent_campaign_contacts')
        .select('contact_id')
        .eq('campaign_id', options.campaignId)

      if (campaignContacts && campaignContacts.length > 0) {
        const contactIds = campaignContacts.map((cc) => cc.contact_id)
        query = query.in('id', contactIds)
      }
    }

    if (!options.includeOptedOut) {
      query = query.or('do_not_call.is.null,do_not_call.eq.false')
      query = query.or('opt_out_sms.is.null,opt_out_sms.eq.false')
    }

    const { data: contacts, error } = await query.order('id', { ascending: true })

    if (error) {
      throw error
    }

    if (!contacts || contacts.length === 0) {
      return 'phone,name,email,company,notes,created_at\n'
    }

    // Build CSV
    const header = 'phone,name,email,company,notes,deal_stage,tags,created_at\n'

    const rows = contacts.map((contact) => {
      const phone = escapeCsvField(contact.phone || '')
      const name = escapeCsvField(contact.name || '')
      const email = escapeCsvField(contact.email || '')
      const company = escapeCsvField(contact.company || '')
      const notes = escapeCsvField(contact.notes || '')
      const dealStage = escapeCsvField(contact.deal_stage || '')
      const tags = escapeCsvField(JSON.stringify(contact.tags || []))
      const createdAt = contact.created_at || ''

      return `${phone},${name},${email},${company},${notes},${dealStage},${tags},${createdAt}`
    })

    const csv = header + rows.join('\n')

    console.log(`[Contact Export] Exported ${contacts.length} contacts`)

    return csv
  } catch (error) {
    console.error('[Contact Export] Error:', error)
    throw error
  }
}

/**
 * Helper: Normalize phone number for import
 * Tries to convert to E.164 format (+1234567890)
 */
function normalizePhoneForImport(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')

  // If 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`
  }

  // If 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  // Otherwise, assume already in correct format
  return digits.startsWith('+') ? phone : `+${digits}`
}

/**
 * Helper: Escape CSV field (wrap in quotes if contains comma/quote/newline)
 */
function escapeCsvField(field: string): string {
  if (!field) return ''

  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }

  return field
}

/**
 * Get import history
 */
export async function getImportHistory(limit: number = 20): Promise<
  Array<{
    id: string
    filename: string
    totalRows: number
    importedRows: number
    failedRows: number
    importedBy: string
    createdAt: string
  }>
> {
  try {
    const { data: logs } = await supabaseAdmin
      .from('voice_agent_contact_import_log')
      .select('id, filename, total_rows, imported_rows, failed_rows, imported_by, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    return (
      logs?.map((log) => ({
        id: log.id,
        filename: log.filename,
        totalRows: log.total_rows,
        importedRows: log.imported_rows,
        failedRows: log.failed_rows,
        importedBy: log.imported_by,
        createdAt: log.created_at,
      })) || []
    )
  } catch (error) {
    console.error('[Contact Import] Error fetching history:', error)
    return []
  }
}
