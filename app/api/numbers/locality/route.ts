// F1500: Vapi number locality - Select phone number locality for best call quality
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const areaCode = searchParams.get('area_code')
    const city = searchParams.get('city')
    const state = searchParams.get('state')

    const vapiApiKey = process.env.VAPI_API_KEY
    if (!vapiApiKey) {
      return NextResponse.json(
        { error: 'VAPI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Search for available phone numbers by locality
    let url = 'https://api.vapi.ai/phone-number/available'
    const params = new URLSearchParams()

    if (areaCode) params.append('areaCode', areaCode)
    if (city) params.append('city', city)
    if (state) params.append('state', state)

    if (params.toString()) {
      url += `?${params.toString()}`
    }

    const vapiResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text()
      console.error('Vapi phone number search failed:', errorText)
      return NextResponse.json(
        { error: `Vapi API error: ${errorText}` },
        { status: vapiResponse.status }
      )
    }

    const availableNumbers = await vapiResponse.json()

    return NextResponse.json({
      success: true,
      available_numbers: availableNumbers,
      count: availableNumbers.length,
    })
  } catch (error: any) {
    console.error('Phone number locality search error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search phone numbers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone_number, area_code, fallback_to_any } = body

    if (!phone_number && !area_code) {
      return NextResponse.json(
        { error: 'Either phone_number or area_code is required' },
        { status: 400 }
      )
    }

    const vapiApiKey = process.env.VAPI_API_KEY
    if (!vapiApiKey) {
      return NextResponse.json(
        { error: 'VAPI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Purchase phone number with specified locality
    const vapiResponse = await fetch('https://api.vapi.ai/phone-number/buy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: phone_number,
        areaCode: area_code,
        fallbackToAny: fallback_to_any !== false, // Default true
      }),
    })

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text()
      console.error('Vapi phone number purchase failed:', errorText)
      return NextResponse.json(
        { error: `Vapi API error: ${errorText}` },
        { status: vapiResponse.status }
      )
    }

    const purchasedNumber = await vapiResponse.json()

    return NextResponse.json({
      success: true,
      phone_number: purchasedNumber,
    })
  } catch (error: any) {
    console.error('Phone number purchase error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to purchase phone number' },
      { status: 500 }
    )
  }
}
