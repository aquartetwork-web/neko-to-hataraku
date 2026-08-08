import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabasePublicEnv, isSupabaseConfigured } from "@/lib/supabase/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase public environment", () => {
  it("is unconfigured when either public value is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(getSupabasePublicEnv()).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("returns the browser-safe project values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", " https://example.supabase.co ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", " sb_publishable_example ");

    expect(getSupabasePublicEnv()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  });
});
