// F1154: Audit logging endpoint - Query audit logs
// F1155: Audit logs are immutable (no PUT/DELETE allowed)

import { NextRequest, NextResponse } from 'next/server'
import { getAuditLogs } from '@/lib/audit-logger'
import { checkAdminAccess } from '@/lib/rbac-middleware'

/**
 * GET /api/audit-log
 * F1154: Query audit logs
 * Query params:
 *   - resource: Filter by resource type
 *   - resourceId: Filter by resource ID
 *   - userId: Filter by user
 *   - action: Filter by action (CREATE, UPDATE, DELETE, etc.)
 *   - limit: Max results (default: 100, max: 1000)
 *   - offset: Pagination offset
 *   - startDate: ISO8601 start date
 *   - endDate: ISO8601 end date
 *
 * Requires: Admin role
 */
export async function GET(request: NextRequest) {
  // Check admin access
  const adminCheck = checkAdminAccess(request)
  if (adminCheck) {
    return adminCheck
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const resource = searchParams.get('resource') || undefined
    const resourceId = searchParams.get('resourceId') || undefined
    const userId = searchParams.get('userId') || undefined
    const action = searchParams.get('action') as any || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
    const offset = parseInt(searchParams.get('offset') || '0')
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined

    const logs = await getAuditLogs({
      resource,
      resourceId,
      userId,
      action,
      limit,
      offset,
      startDate,
      endDate,
    })

    return NextResponse.json({
      success: true,
      logs,
      limit,
      offset,
      filters: {
        resource: resource || null,
        resourceId: resourceId || null,
        userId: userId || null,
        action: action || null,
      },
    })
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

/**
 * F1155: Audit log immutability
 * PUT and DELETE are not allowed on audit logs
 */
export async function PUT(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Audit logs are immutable',
      code: 'IMMUTABLE_RESOURCE',
    },
    { status: 405 }
  )
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Audit logs are immutable',
      code: 'IMMUTABLE_RESOURCE',
    },
    { status: 405 }
  )
}

export async function PATCH(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Audit logs are immutable',
      code: 'IMMUTABLE_RESOURCE',
    },
    { status: 405 }
  )
}
