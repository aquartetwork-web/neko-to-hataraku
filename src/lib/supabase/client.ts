import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export function createClient() {
  const env = getSupabasePublicEnv();

  if (!env) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  return createBrowserClient<Database>(env.url, env.publishableKey);
}
