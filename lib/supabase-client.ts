/**
 * Re-export supabase client for test compatibility
 * Some tests import from '@/lib/supabase-client' while the actual implementation is in lib/supabase.ts
 */

export { supabase, supabaseAdmin, checkDatabaseHealth } from './supabase'
