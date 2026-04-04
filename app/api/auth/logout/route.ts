// F0983: POST /api/auth/logout - Logout current user

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Clear auth token from session/cookies
    const response = NextResponse.json({
      success: true,
      message: 'Successfully logged out'
    })

    // Clear auth cookie if present
    response.cookies.set('auth_token', '', { maxAge: 0, path: '/' })
    response.cookies.set('auth_session', '', { maxAge: 0, path: '/' })

    return response
  } catch (error) {
    console.error('Error during logout:', error)
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    )
  }
}
