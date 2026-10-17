/**
 * Supabase client for the SERVER (server components, route handlers, server actions).
 *
 * Reads and writes the auth session through Next.js cookies (standard @supabase/ssr
 * App Router pattern). Create a new client for every request — never share one.
 * Still uses the anon/publishable key, so RLS applies as the signed-in user.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: middleware.ts (Step 6) refreshes the session.
          }
        },
      },
    },
  );
}
