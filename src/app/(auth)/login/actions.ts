"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildAuthConfirmUrl, resolveSiteOrigin } from "@/lib/auth/app-url";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function reportMagicLinkError(error: AuthError) {
  console.error(
    "[auth] signInWithOtp failed",
    JSON.stringify({
      name: error.name,
      code: error.code,
      status: error.status,
      message: error.message,
    }),
  );
}

export async function sendMagicLink(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=not-configured");
  }

  const email = formData.get("email")?.toString().trim().toLowerCase();

  if (!email || !email.includes("@")) {
    redirect("/login?error=invalid-email");
  }

  const requestHeaders = await headers();
  const siteOrigin = resolveSiteOrigin({
    configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    vercelUrl: process.env.VERCEL_URL,
    requestOrigin: requestHeaders.get("origin"),
  });

  if (!siteOrigin) {
    redirect("/login?error=site-url");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: buildAuthConfirmUrl(siteOrigin),
      shouldCreateUser: false,
    },
  });

  if (error) {
    reportMagicLinkError(error);
    redirect("/login?error=send-failed");
  }

  redirect("/login?sent=1");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
