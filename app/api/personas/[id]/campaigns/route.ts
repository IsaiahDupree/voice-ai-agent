// F0786: Persona apply to campaigns - GET/POST persona campaign assignments

import { NextRequest, NextResponse } from 'next/server'
import { getPersonaCampaigns, assignPersonaToCampaigns } from '@/lib/persona-builder'

interface RouteParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const personaId = params.id

    if (!personaId) {
      return NextResponse.json(
        { error: 'Persona ID is required' },
        { status: 400 }
      )
    }

    const campaigns = await getPersonaCampaigns(personaId)

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('Error fetching persona campaigns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const personaId = params.id
    const { campaignIds } = await request.json()

    if (!personaId) {
      return NextResponse.json(
        { error: 'Persona ID is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(campaignIds)) {
      return NextResponse.json(
        { error: 'campaignIds must be an array' },
        { status: 400 }
      )
    }

    const success = await assignPersonaToCampaigns(personaId, campaignIds)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to assign campaigns' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Persona assigned to ${campaignIds.length} campaigns`
    })
  } catch (error) {
    console.error('Error assigning campaigns:', error)
    return NextResponse.json(
      { error: 'Failed to assign campaigns' },
      { status: 500 }
    )
  }
}
