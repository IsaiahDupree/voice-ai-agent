// F0174: Caller reputation check API

import { NextRequest, NextResponse } from 'next/server'
import { checkCallerReputation, flagAsSpam, handleSpamCaller } from '@/lib/caller-reputation'

// F0174: Check caller reputation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone_number } = body

    if (!phone_number) {
      return NextResponse.json(
        { error: 'phone_number is required' },
        { status: 400 }
      )
    }

    const reputation = await checkCallerReputation(phone_number)
    const handling = await handleSpamCaller(phone_number, reputation)

    return NextResponse.json({
      success: true,
      phone_number,
      reputation,
      handling,
    })
  } catch (error: any) {
    console.error('Error checking caller reputation:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check reputation' },
      { status: 500 }
    )
  }
}

// F0174: Manually flag phone number as spam
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone_number, notes } = body

    if (!phone_number) {
      return NextResponse.json(
        { error: 'phone_number is required' },
        { status: 400 }
      )
    }

    await flagAsSpam(phone_number, notes)

    return NextResponse.json({
      success: true,
      message: 'Phone number flagged as spam',
      phone_number,
    })
  } catch (error: any) {
    console.error('Error flagging as spam:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to flag as spam' },
      { status: 500 }
    )
  }
}
