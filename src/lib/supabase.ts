import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
  // Explicit session durability: persist across reloads and keep the access
  // token fresh in the background so users aren't silently logged out.
  auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});
