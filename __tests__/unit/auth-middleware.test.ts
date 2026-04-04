// F1208: Unit test: JWT middleware
// Test auth middleware with valid/invalid tokens
// Acceptance: Valid passes, invalid 401

/**
 * @jest-environment node
 */

import {
  getUserFromRequest,
  requireAdmin,
  requireOperator,
  hasRole,
  isAdmin,
  isOperator,
  type UserRole,
} from '@/lib/campaign-rbac'

describe('Auth Middleware - RBAC', () => {
  describe('getUserFromRequest', () => {
    it('should return admin user when valid admin key is provided', async () => {
      const request = new Request('http://localhost:3000/test', {
        headers: {
          'x-admin-key': 'test-admin-key-for-testing',
        },
      })

      const user = await getUserFromRequest(request)

      expect(user).not.toBeNull()
      expect(user?.role).toBe('admin')
      expect(user?.email).toBe('admin@system')
    })

    it('should return null when no auth headers are provided', async () => {
      const request = new Request('http://localhost:3000/test')

      const user = await getUserFromRequest(request)

      expect(user).toBeNull()
    })

    it('should return null when invalid admin key is provided', async () => {
      const request = new Request('http://localhost:3000/test', {
        headers: {
          'x-admin-key': 'invalid-key',
        },
      })

      const user = await getUserFromRequest(request)

      expect(user).toBeNull()
    })

    it('should return null when empty admin key is provided', async () => {
      const request = new Request('http://localhost:3000/test', {
        headers: {
          'x-admin-key': '',
        },
      })

      const user = await getUserFromRequest(request)

      expect(user).toBeNull()
    })
  })

  describe('requireAdmin', () => {
    it('should return null for admin users (allows access)', () => {
      const adminUser = {
        id: '1',
        email: 'admin@test.com',
        role: 'admin' as UserRole,
      }

      const result = requireAdmin(adminUser)

      expect(result).toBeNull()
    })

    it('should return 403 Response for operator users', () => {
      const operatorUser = {
        id: '2',
        email: 'operator@test.com',
        role: 'operator' as UserRole,
      }

      const result = requireAdmin(operatorUser)

      expect(result).not.toBeNull()
      expect(result?.status).toBe(403)
    })

    it('should return 403 Response for viewer users', () => {
      const viewerUser = {
        id: '3',
        email: 'viewer@test.com',
        role: 'viewer' as UserRole,
      }

      const result = requireAdmin(viewerUser)

      expect(result).not.toBeNull()
      expect(result?.status).toBe(403)
    })

    it('should return 403 Response for null user', () => {
      const result = requireAdmin(null)

      expect(result).not.toBeNull()
      expect(result?.status).toBe(403)
    })

    it('should include error message in 403 response', async () => {
      const result = requireAdmin(null)

      expect(result).not.toBeNull()

      if (result) {
        const body = await result.json()
        expect(body.error).toBe('Forbidden')
        expect(body.message).toContain('Admin role required')
      }
    })
  })

  describe('requireOperator', () => {
    it('should return null for admin users (allows access)', () => {
      const adminUser = {
        id: '1',
        email: 'admin@test.com',
        role: 'admin' as UserRole,
      }

      const result = requireOperator(adminUser)

      expect(result).toBeNull()
    })

    it('should return null for operator users (allows access)', () => {
      const operatorUser = {
        id: '2',
        email: 'operator@test.com',
        role: 'operator' as UserRole,
      }

      const result = requireOperator(operatorUser)

      expect(result).toBeNull()
    })

    it('should return 403 Response for viewer users', () => {
      const viewerUser = {
        id: '3',
        email: 'viewer@test.com',
        role: 'viewer' as UserRole,
      }

      const result = requireOperator(viewerUser)

      expect(result).not.toBeNull()
      expect(result?.status).toBe(403)
    })

    it('should return 403 Response for null user', () => {
      const result = requireOperator(null)

      expect(result).not.toBeNull()
      expect(result?.status).toBe(403)
    })
  })

  describe('Role hierarchy - hasRole', () => {
    const adminUser = { id: '1', email: 'admin@test.com', role: 'admin' as UserRole }
    const operatorUser = { id: '2', email: 'operator@test.com', role: 'operator' as UserRole }
    const viewerUser = { id: '3', email: 'viewer@test.com', role: 'viewer' as UserRole }

    it('admin should have all roles', () => {
      expect(hasRole(adminUser, 'admin')).toBe(true)
      expect(hasRole(adminUser, 'operator')).toBe(true)
      expect(hasRole(adminUser, 'viewer')).toBe(true)
    })

    it('operator should have operator and viewer roles only', () => {
      expect(hasRole(operatorUser, 'admin')).toBe(false)
      expect(hasRole(operatorUser, 'operator')).toBe(true)
      expect(hasRole(operatorUser, 'viewer')).toBe(true)
    })

    it('viewer should only have viewer role', () => {
      expect(hasRole(viewerUser, 'admin')).toBe(false)
      expect(hasRole(viewerUser, 'operator')).toBe(false)
      expect(hasRole(viewerUser, 'viewer')).toBe(true)
    })

    it('null user should have no roles', () => {
      expect(hasRole(null, 'admin')).toBe(false)
      expect(hasRole(null, 'operator')).toBe(false)
      expect(hasRole(null, 'viewer')).toBe(false)
    })
  })

  describe('isAdmin', () => {
    it('should return true for admin users', () => {
      const adminUser = { id: '1', email: 'admin@test.com', role: 'admin' as UserRole }
      expect(isAdmin(adminUser)).toBe(true)
    })

    it('should return false for operator users', () => {
      const operatorUser = { id: '2', email: 'operator@test.com', role: 'operator' as UserRole }
      expect(isAdmin(operatorUser)).toBe(false)
    })

    it('should return false for viewer users', () => {
      const viewerUser = { id: '3', email: 'viewer@test.com', role: 'viewer' as UserRole }
      expect(isAdmin(viewerUser)).toBe(false)
    })

    it('should return false for null user', () => {
      expect(isAdmin(null)).toBe(false)
    })
  })

  describe('isOperator', () => {
    it('should return true for admin users', () => {
      const adminUser = { id: '1', email: 'admin@test.com', role: 'admin' as UserRole }
      expect(isOperator(adminUser)).toBe(true)
    })

    it('should return true for operator users', () => {
      const operatorUser = { id: '2', email: 'operator@test.com', role: 'operator' as UserRole }
      expect(isOperator(operatorUser)).toBe(true)
    })

    it('should return false for viewer users', () => {
      const viewerUser = { id: '3', email: 'viewer@test.com', role: 'viewer' as UserRole }
      expect(isOperator(viewerUser)).toBe(false)
    })

    it('should return false for null user', () => {
      expect(isOperator(null)).toBe(false)
    })
  })
})
