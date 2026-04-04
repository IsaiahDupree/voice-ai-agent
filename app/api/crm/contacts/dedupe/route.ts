// F0592: Contact dedup detection

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface DedupRequest {
  phone_number?: string
  email?: string
  name?: string
  org_id: string
}

interface DuplicateMatch {
  contact_id: string
  phone_number?: string
  email?: string
  name?: string
  match_score: number
  match_type: 'exact' | 'fuzzy'
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()
  if (s1 === s2) return 1.0

  let matches = 0
  for (let i = 0; i < Math.min(s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) matches++
  }
  return matches / Math.max(s1.length, s2.length)
}

// POST /api/crm/contacts/dedupe - Detect potential duplicates
export async function POST(request: NextRequest) {
  try {
    const body: DedupRequest = await request.json()

    if (!body.org_id) {
      return NextResponse.json(
        { error: 'org_id is required' },
        { status: 400 }
      )
    }

    if (!body.phone_number && !body.email && !body.name) {
      return NextResponse.json(
        { error: 'At least one of phone_number, email, or name is required' },
        { status: 400 }
      )
    }

    const potentialMatches: DuplicateMatch[] = []

    // Check for exact phone number match
    if (body.phone_number) {
      const { data: phoneMatches } = await supabaseAdmin
        .from('crm_contacts')
        .select('id, phone_number, email, name')
        .eq('org_id', body.org_id)
        .eq('phone_number', body.phone_number)
        .limit(5)

      if (phoneMatches) {
        phoneMatches.forEach((match: any) => {
          if (match.id) {
            potentialMatches.push({
              contact_id: match.id,
              phone_number: match.phone_number,
              email: match.email,
              name: match.name,
              match_score: 1.0,
              match_type: 'exact',
            })
          }
        })
      }
    }

    // Check for email match
    if (body.email && potentialMatches.length === 0) {
      const { data: emailMatches } = await supabaseAdmin
        .from('crm_contacts')
        .select('id, phone_number, email, name')
        .eq('org_id', body.org_id)
        .eq('email', body.email)
        .limit(5)

      if (emailMatches) {
        emailMatches.forEach((match: any) => {
          if (match.id) {
            potentialMatches.push({
              contact_id: match.id,
              phone_number: match.phone_number,
              email: match.email,
              name: match.name,
              match_score: 1.0,
              match_type: 'exact',
            })
          }
        })
      }
    }

    // Fuzzy name match if no exact matches
    if (body.name && potentialMatches.length === 0) {
      const { data: allContacts } = await supabaseAdmin
        .from('crm_contacts')
        .select('id, phone_number, email, name')
        .eq('org_id', body.org_id)
        .limit(20)

      if (allContacts) {
        allContacts.forEach((contact: any) => {
          if (contact.name) {
            const similarity = calculateSimilarity(body.name!, contact.name)
            if (similarity > 0.7) {
              potentialMatches.push({
                contact_id: contact.id,
                phone_number: contact.phone_number,
                email: contact.email,
                name: contact.name,
                match_score: similarity,
                match_type: 'fuzzy',
              })
            }
          }
        })
      }
    }

    return NextResponse.json({
      input: body,
      duplicates_found: potentialMatches.length > 0,
      potential_matches: potentialMatches.sort((a, b) => b.match_score - a.match_score),
      recommendation: potentialMatches.length > 0 ? 'merge' : 'create_new',
    })
  } catch (error: any) {
    console.error('Error detecting duplicates:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
