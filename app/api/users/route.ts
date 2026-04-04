// F1463: GET /api/users - List users in organization

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from headers (set by middleware)
    const userId = request.headers.get('x-user-id')
    const organizationId = request.headers.get('x-organization-id')

    if (!userId || !organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0')

    // Get users in the organization
    const { data: users, error, count } = await supabaseAdmin
      .from('user_organizations')
      .select(
        `
        user_id,
        role,
        created_at,
        user:users(id, email, name, avatar_url)
        `,
        { count: 'exact' }
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    // Format response
    const formattedUsers = users?.map((uo: any) => ({
      id: uo.user_id,
      email: uo.user?.email,
      name: uo.user?.name,
      avatar_url: uo.user?.avatar_url,
      role: uo.role,
      joined_at: uo.created_at,
    })) || []

    return NextResponse.json(
      {
        success: true,
        data: formattedUsers,
        pagination: {
          limit,
          offset,
          total: count || 0,
          page: Math.floor(offset / limit) + 1,
          pages: Math.ceil((count || 0) / limit),
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Unexpected error in GET /api/users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
