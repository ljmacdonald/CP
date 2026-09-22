import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Service-role Supabase client. This bypasses Row Level Security, so it must
 * never be imported from client components — the `server-only` import above
 * makes that a build error rather than a runtime leak.
 *
 * Deliberately untyped (no `Database` generic): our schema types in
 * types/database.ts are hand-authored (there is no live project to run
 * `supabase gen types typescript` against) and don't satisfy postgrest-js's
 * internal GenericSchema constraints for `Functions`/`Views`. Each service
 * function declares its own explicit return type instead, which is what
 * callers actually rely on.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  const env = getServerEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured to reach the database"
    );
  }
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
