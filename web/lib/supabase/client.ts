/**
 * Supabase client for the BROWSER (client components).
 *
 * Uses only the public URL and the anon/publishable key. Row Level Security
 * in supabase/schema.sql is what limits each reader to their own rows.
 * Never put the service role / secret key here.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
