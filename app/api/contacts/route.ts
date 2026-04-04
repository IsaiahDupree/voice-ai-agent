// F0919: POST /api/contacts - Creates new contact
// F0567-F0570: Contact CRUD operations

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizePhoneNumber } from '@/lib/phone-utils'

// F0919: Create contact
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, email, name, first_name, last_name, company, source, notes, tags } = body

    // F0603: Contact phone format - validate E.164
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // F0604: Contact phone normalize
    const normalizedPhone = normalizePhoneNumber(phone)

    // F0570: Contact upsert on phone (unique key)
    const { data, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .upsert(
        {
          phone: normalizedPhone,
          email,
          name,
          first_name,
          last_name,
          company,
          source: source || 'manual',
          notes,
          tags,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'phone' }
      )
      .select()
      .single()

    if (error) {
      console.error('Error creating contact:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ contact: data }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/contacts:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// F0567, F0572, F0573: Contact lookup by phone, list with pagination, search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const email = searchParams.get('email')
    const createIfNew = searchParams.get('create_if_new') === 'true' // F0425
    const name = searchParams.get('name')
    const search = searchParams.get('q') || searchParams.get('search') // F0573: Search query
    const page = parseInt(searchParams.get('page') || '1') // F0572: Pagination
    const limit = parseInt(searchParams.get('limit') || '50') // F0572: Pagination

    // F0572, F0573: List all contacts with pagination and search
    if (!phone && !email) {
      const offset = (page - 1) * limit

      let query = supabaseAdmin
        .from('voice_agent_contacts')
        .select('*', { count: 'exact' })

      // F0573: Search by name, email, or phone
      if (search) {
        const searchTerm = `%${search}%`
        query = query.or(
          `name.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm},company.ilike.${searchTerm}`
        )
      }

      // F0572: Pagination
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        contacts: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      })
    }

    // Lookup by phone or email
    let query = supabaseAdmin.from('voice_agent_contacts').select('*')

    if (phone) {
      const normalizedPhone = normalizePhoneNumber(phone)
      query = query.eq('phone', normalizedPhone)
    } else if (email) {
      query = query.eq('email', email)
    }

    const { data, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') {
        // F0425: Not found - create if create_if_new is true
        if (createIfNew && phone) {
          const normalizedPhone = normalizePhoneNumber(phone)

          const { data: newContact, error: createError } = await supabaseAdmin
            .from('voice_agent_contacts')
            .insert({
              phone: normalizedPhone,
              email: email || null,
              name: name || null,
              source: 'voice_agent_lookup',
              created_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (createError) {
            return NextResponse.json({ error: createError.message }, { status: 500 })
          }

          return NextResponse.json({ contact: newContact, created: true })
        }

        // Not found and not creating
        return NextResponse.json({ contact: null }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // F0365: lookupContact history - add last_contact and deal_stage
    let enrichedContact = { ...data }

    if (data?.id) {
      // Get last contact date from calls
      const { data: lastCall } = await supabaseAdmin
        .from('voice_agent_calls')
        .select('created_at')
        .eq('customer_phone', data.phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (lastCall) {
        enrichedContact.last_contact = lastCall.created_at
      }

      // Get deal stage from metadata or default
      enrichedContact.deal_stage = data.metadata?.deal_stage || 'new'
    }

    return NextResponse.json({ contact: enrichedContact })
  } catch (error: any) {
    console.error('Error in GET /api/contacts:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// F0569: Contact update
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ contact: data })
  } catch (error: any) {
    console.error('Error in PATCH /api/contacts:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
