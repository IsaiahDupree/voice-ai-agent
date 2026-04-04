// F0985: GET /api/users/me - Get current user info

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/user-context'

export async function GET(request: NextRequest) {
  try {
    // Get current user from context
    const user = getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization_id: user.organization_id
    })
  } catch (error) {
    console.error('Error fetching current user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}
