// ========================================
// diyaa.ai — Supabase Clients
// Public client for frontend, service client for API routes.
// ========================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Frontend client (uses anon key, respects RLS)
export const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// Server-side client (uses service role key, bypasses RLS)
let _serviceClient: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    _serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  }
  return _serviceClient
}
