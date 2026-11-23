import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** Non-null only when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured. */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
