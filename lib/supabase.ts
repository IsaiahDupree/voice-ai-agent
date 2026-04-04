import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
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
