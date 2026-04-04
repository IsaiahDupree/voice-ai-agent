// F1139: RBAC roles - admin/agent/viewer roles defined
// F1140: RBAC admin only - Admin-only endpoints reject other roles
// F1141: RBAC viewer - Viewer role read-only access

/**
 * F1139: Define RBAC roles and their capabilities
 */
export type UserRole = 'admin' | 'agent' | 'viewer' | 'system'

export interface RolePermissions {
  canCreateCampaigns: boolean
  canDeleteCampaigns: boolean
  canViewAnalytics: boolean
  canViewContacts: boolean
  canManageUsers: boolean
  canConfigureSettings: boolean
  canViewTranscripts: boolean
  canManageApiKeys: boolean
  canAccessAuditLog: boolean
  canUpdatePersonas: boolean
  canTransferCalls: boolean
}

const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canCreateCampaigns: true,
    canDeleteCampaigns: true,
    canViewAnalytics: true,
    canViewContacts: true,
    canManageUsers: true,
    canConfigureSettings: true,
    canViewTranscripts: true,
    canManageApiKeys: true,
    canAccessAuditLog: true,
    canUpdatePersonas: true,
    canTransferCalls: true,
  },
  agent: {
    canCreateCampaigns: true,
    canDeleteCampaigns: false,
    canViewAnalytics: true,
    canViewContacts: true,
    canManageUsers: false,
    canConfigureSettings: false,
    canViewTranscripts: true,
    canManageApiKeys: false,
    canAccessAuditLog: false,
    canUpdatePersonas: false,
    canTransferCalls: true,
  },
  // F1141: Viewer role - read-only access
  viewer: {
    canCreateCampaigns: false,
    canDeleteCampaigns: false,
    canViewAnalytics: true,
    canViewContacts: true,
    canManageUsers: false,
    canConfigureSettings: false,
    canViewTranscripts: true,
    canManageApiKeys: false,
    canAccessAuditLog: false,
    canUpdatePersonas: false,
    canTransferCalls: false,
  },
  system: {
    canCreateCampaigns: true,
    canDeleteCampaigns: true,
    canViewAnalytics: true,
    canViewContacts: true,
    canManageUsers: true,
    canConfigureSettings: true,
    canViewTranscripts: true,
    canManageApiKeys: true,
    canAccessAuditLog: true,
    canUpdatePersonas: true,
    canTransferCalls: true,
  },
}

/**
 * Get permissions for a role
 */
export function getRolePermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: UserRole,
  permission: keyof RolePermissions
): boolean {
  const permissions = getRolePermissions(role)
  return permissions[permission] === true
}

/**
 * Check if role is admin (F1140)
 */
export function isAdmin(role: UserRole): boolean {
  return role === 'admin' || role === 'system'
}

/**
 * Check if role is viewer (F1141)
 */
export function isViewer(role: UserRole): boolean {
  return role === 'viewer'
}

/**
 * List all available roles
 */
export function listRoles(): UserRole[] {
  return ['admin', 'agent', 'viewer']
}
