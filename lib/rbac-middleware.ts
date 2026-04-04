// RBAC middleware and utility functions for enforcing role-based access control

import { NextRequest, NextResponse } from 'next/server'
import { UserRole, hasPermission, isAdmin, RolePermissions } from './rbac'

/**
 * Extract user role from request
 * Can come from JWT token, session, or headers
 */
export function extractUserRole(request: NextRequest): UserRole {
  // Try to extract from x-user-role header
  const roleHeader = request.headers.get('x-user-role') as UserRole
  if (roleHeader) {
    return roleHeader
  }

  // Default to viewer (least privileged)
  return 'viewer'
}

/**
 * F1140: Enforce admin-only access
 * Returns 403 if user is not admin
 */
export function requireAdminRole(request: NextRequest): NextResponse | null {
  const role = extractUserRole(request)

  if (!isAdmin(role)) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'This endpoint requires admin role',
      },
      { status: 403 }
    )
  }

  return null
}

/**
 * Enforce specific permission check
 * Returns 403 if user lacks the permission
 */
export function requirePermission(
  request: NextRequest,
  permission: keyof RolePermissions
): NextResponse | null {
  const role = extractUserRole(request)

  if (!hasPermission(role, permission)) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `This action requires "${permission}" permission`,
      },
      { status: 403 }
    )
  }

  return null
}

/**
 * Middleware helper for role-based access control
 * Usage: const check = checkRBACAccess(request, 'canCreateCampaigns')
 *        if (check) return check
 */
export function checkRBACAccess(
  request: NextRequest,
  permission: keyof RolePermissions
): NextResponse | null {
  return requirePermission(request, permission)
}

/**
 * Middleware helper for admin-only endpoints
 * Usage: const check = checkAdminAccess(request)
 *        if (check) return check
 */
export function checkAdminAccess(request: NextRequest): NextResponse | null {
  return requireAdminRole(request)
}
