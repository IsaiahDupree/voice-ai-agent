import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface ScoredOffer {
  offer: any
  score: number
  reasons: string[]
}

function scoreOffer(
  offer: any,
  business: any
): ScoredOffer {
  let score = 0
  const reasons: string[] = []

  // Niche match: if the business niche is in the offer's ideal_niches
  const idealNiches: string[] = offer.ideal_niches || []
  if (idealNiches.length > 0 && business.niche) {
    const nicheMatch = idealNiches.some(
      (n: string) => n.toLowerCase() === business.niche.toLowerCase()
    )
    if (nicheMatch) {
      score += 40
      reasons.push(`Niche "${business.niche}" is an ideal fit`)
    } else {
      // Partial match via substring
      const partialMatch = idealNiches.some(
        (n: string) =>
          business.niche.toLowerCase().includes(n.toLowerCase()) ||
          n.toLowerCase().includes(business.niche.toLowerCase())
      )
      if (partialMatch) {
        score += 20
        reasons.push(`Niche "${business.niche}" partially matches ideal niches`)
      }
    }
  }

  // Rating-based scoring: lower-rated businesses may need more help
  if (business.rating !== null && business.rating !== undefined) {
    if (business.rating < 3.5) {
      score += 15
      reasons.push(`Low rating (${business.rating}) suggests need for reputation help`)
    } else if (business.rating < 4.0) {
      score += 10
      reasons.push(`Moderate rating (${business.rating}) — room for improvement`)
    } else {
      score += 5
      reasons.push(`High rating (${business.rating}) — growth-focused offers fit`)
    }
  }

  // Review count scoring: businesses with few reviews may need marketing
  if (business.review_count !== null && business.review_count !== undefined) {
    if (business.review_count < 10) {
      score += 15
      reasons.push(`Few reviews (${business.review_count}) — marketing needed`)
    } else if (business.review_count < 50) {
      score += 10
      reasons.push(`Moderate reviews (${business.review_count})`)
    }
  }

  // Website presence
  if (!business.website) {
    score += 10
    reasons.push('No website detected — web services offer relevant')
  }

  // Offer type bonuses for common needs
  if (offer.offer_type === 'audit') {
    score += 5
    reasons.push('Audit offers have high acceptance rates')
  }

  // Active offer bonus
  if (offer.active) {
    score += 5
  }

  return { offer, score, reasons }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId } = body

    if (!businessId) {
      return NextResponse.json(
        { error: 'businessId is required' },
        { status: 400 }
      )
    }

    // Fetch business
    const { data: business, error: bizError } = await supabaseAdmin
      .from('localreach_businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (bizError) {
      if (bizError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Business not found' },
          { status: 404 }
        )
      }
      throw bizError
    }

    // Fetch all active offers
    const { data: offers, error: offersError } = await supabaseAdmin
      .from('localreach_offers')
      .select('*')
      .eq('active', true)

    if (offersError) throw offersError

    if (!offers || offers.length === 0) {
      return NextResponse.json({
        success: true,
        businessId,
        businessName: business.name,
        matches: [],
        message: 'No active offers available',
      })
    }

    // Score and rank offers
    const scored = offers
      .map(offer => scoreOffer(offer, business))
      .sort((a, b) => b.score - a.score)

    return NextResponse.json({
      success: true,
      businessId,
      businessName: business.name,
      matches: scored.map(s => ({
        offerId: s.offer.id,
        offerName: s.offer.name,
        offerType: s.offer.offer_type,
        headline: s.offer.headline,
        pricing: s.offer.pricing,
        score: s.score,
        reasons: s.reasons,
      })),
    })
  } catch (error: any) {
    console.error('[Offer Match API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to match offers' },
      { status: 500 }
    )
  }
}
