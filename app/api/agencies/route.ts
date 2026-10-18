/**
 * /api/agencies — list/get agencies.
 *
 * GET ?userId=<id> → the agency this user belongs to (1:1 at v1.0).
 * GET (no params)  → service-role only; lists all agencies.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAgencyForUser, getAgencyById } from '@/lib/agency'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (userId) {
    const agency = await getAgencyForUser(userId)
    return NextResponse.json({ agency })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const agency = await getAgencyById(id)
    return NextResponse.json({ agency })
  }
  const { data, error } = await supabaseAdmin
    .from('agencies')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ agencies: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  const { name, slug, contact_email, plan = 'starter' } = body
  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug required' }, { status: 400 })
  }
  const { data, error } = await supabaseAdmin
    .from('agencies')
    .insert({
      name,
      slug,
      contact_email,
      plan,
      max_clients: plan === 'enterprise' ? 1000 : plan === 'scale' ? 50 : plan === 'growth' ? 25 : 5,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ agency: data })
}
