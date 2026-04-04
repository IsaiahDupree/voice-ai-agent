// F0253: Campaign RBAC
// Role-based access control for campaign operations
// Only admin role can start/stop campaigns

import { supabaseAdmin } from './supabase';

export type UserRole = 'admin' | 'operator' | 'viewer';

interface User {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Get user by email
 * F0253: Campaign RBAC
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      console.log(`[RBAC] User not found: ${email}`);
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      role: data.role as UserRole
    };
  } catch (err) {
    console.error('[RBAC] Error fetching user:', err);
    return null;
  }
}

/**
 * Check if user has required role
 * F0253: Campaign RBAC
 */
export function hasRole(user: User | null, requiredRole: UserRole): boolean {
  if (!user) return false;

  const roleHierarchy: Record<UserRole, number> = {
    viewer: 1,
    operator: 2,
    admin: 3
  };

  const userLevel = roleHierarchy[user.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
}

/**
 * Check if user is admin
 * F0253: Campaign RBAC
 */
export function isAdmin(user: User | null): boolean {
  return hasRole(user, 'admin');
}

/**
 * Check if user is operator or higher
 * F0253: Campaign RBAC
 */
export function isOperator(user: User | null): boolean {
  return hasRole(user, 'operator');
}

/**
 * Middleware helper: extract user from request headers
 * Expects either:
 * - x-user-email header (for authenticated requests)
 * - x-admin-key header (bypass with master admin key)
 *
 * F0253: Campaign RBAC
 */
export async function getUserFromRequest(request: Request): Promise<User | null> {
  const headers = request.headers;

  // Check for admin bypass key
  const adminKey = headers.get('x-admin-key');
  if (adminKey === process.env.ADMIN_API_KEY && adminKey) {
    // Return synthetic admin user
    return {
      id: 'admin-key',
      email: 'admin@system',
      role: 'admin'
    };
  }

  // Check for user email header (from auth middleware)
  const email = headers.get('x-user-email');
  if (!email) {
    console.log('[RBAC] No user email in request headers');
    return null;
  }

  return await getUserByEmail(email);
}

/**
 * Require admin role for operation
 * Returns error response if user is not admin
 *
 * F0253: Campaign RBAC
 *
 * Usage in API routes:
 * ```
 * const user = await getUserFromRequest(request);
 * const error = requireAdmin(user);
 * if (error) return error;
 * ```
 */
export function requireAdmin(user: User | null): Response | null {
  if (!isAdmin(user)) {
    return new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Admin role required for this operation'
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}

/**
 * Require operator role or higher
 * F0253: Campaign RBAC
 */
export function requireOperator(user: User | null): Response | null {
  if (!isOperator(user)) {
    return new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Operator role required for this operation'
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}

/**
 * Create or update a user
 * F0253: Campaign RBAC
 */
export async function upsertUser(
  email: string,
  role: UserRole
): Promise<User | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_users')
      .upsert(
        {
          email,
          role,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (error || !data) {
      console.error('[RBAC] Failed to upsert user:', error);
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      role: data.role as UserRole
    };
  } catch (err) {
    console.error('[RBAC] Exception upserting user:', err);
    return null;
  }
}
