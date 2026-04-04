/**
 * User context and utilities
 * Manages current user role and organization context
 */

export type UserRole = 'admin' | 'manager' | 'agent' | 'viewer'

export interface User {
  id?: string
  email?: string
  role: UserRole
  organization_id?: string
  name?: string
}

export interface UserContextType {
  user: User | null
  loading: boolean
  error?: string
}

const DEFAULT_USER: User = {
  role: 'admin',
  organization_id: 'default-org',
  name: 'Current User'
}

/**
 * Get current user from context or storage
 * Falls back to default user if not authenticated
 */
export function getCurrentUser(): User {
  if (typeof window === 'undefined') {
    return DEFAULT_USER
  }

  try {
    const stored = sessionStorage.getItem('user')
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (_e) {
    // ignore parse errors
  }

  return DEFAULT_USER
}

/**
 * Set current user in storage
 */
export function setCurrentUser(user: User) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('user', JSON.stringify(user))
  }
}

/**
 * Get role display label
 */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Administrator',
    manager: 'Manager',
    agent: 'Agent',
    viewer: 'Viewer'
  }
  return labels[role] || role
}

/**
 * Check if user has required role
 */
export function hasRole(user: User, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    admin: 4,
    manager: 3,
    agent: 2,
    viewer: 1
  }
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole]
}

/**
 * Check if user can perform action
 */
export function canPerformAction(user: User, action: string): boolean {
  const actionPermissions: Record<UserRole, string[]> = {
    admin: ['*'],
    manager: ['view', 'edit_team', 'delete_calls'],
    agent: ['view', 'edit_own'],
    viewer: ['view']
  }

  const permissions = actionPermissions[user.role]
  return permissions.includes('*') || permissions.includes(action)
}
