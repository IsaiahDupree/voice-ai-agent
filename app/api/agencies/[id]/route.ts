/**
 * /api/agencies/[id] — agency-scoped read + branding update.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAgencyById } from '@/lib/agency'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const agency = await getAgencyById(params.id)
  if (!agency) return NextResponse.json({ error: 'agency_not_found' }, { status: 404 })
  return NextResponse.json({ agency })
}

const ALLOWED_FIELDS = new Set([
  'name',
  'logo_url',
  'primary_color',
  'contact_email',
  'contact_phone',
])

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) patch[k] = v
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_updatable_fields' }, { status: 400 })
  }

  // Light validation. primary_color must be a hex.
  if (typeof patch.primary_color === 'string' && !/^#[0-9a-fA-F]{6}$/.test(patch.primary_color as string)) {
    return NextResponse.json({ error: 'primary_color must be 6-digit hex (e.g. #2563eb)' }, { status: 400 })
  }
  if (typeof patch.logo_url === 'string' && (patch.logo_url as string).length > 0) {
    try {
      // Reject non-https logos so digests don't get blocked by clients.
      const u = new URL(patch.logo_url as string)
      if (u.protocol !== 'https:') {
        return NextResponse.json({ error: 'logo_url must be https' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'logo_url must be a valid URL' }, { status: 400 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('agencies')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ agency: data })
}
