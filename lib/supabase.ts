import { createClient, SupabaseClient } from '@supabase/supabase-js'

const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'

let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      _supabase = createClient(supabaseUrl, supabaseAnonKey)
    }
    return (_supabase as any)[prop]
  },
})

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    }
    return (_supabaseAdmin as any)[prop]
  },
})

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  responseTimeMs: number;
}> {
  const start = Date.now();

  try {
    const { error } = await supabaseAdmin
      .from('call_logs')
      .select('id')
      .limit(1);

    const responseTimeMs = Date.now() - start;

    return {
      healthy: !error,
      responseTimeMs,
    };
  } catch (error) {
    return {
      healthy: false,
      responseTimeMs: Date.now() - start,
    };
  }
}
