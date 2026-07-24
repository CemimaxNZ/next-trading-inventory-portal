"use server";

import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isEmailLike } from "@/lib/user-identity";
import { loginSchema } from "@/lib/validators";

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.parse({
    identifier: String(formData.get("identifier") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  const nextPath = String(formData.get("next") ?? "/");
  const supabase = await createServerSupabaseClient();
  const adminClient = createAdminSupabaseClient();
  const identifier = parsed.identifier.trim();
  const email = isEmailLike(identifier)
    ? identifier.toLowerCase()
    : await resolveEmailFromIdentifier(adminClient, identifier);

  if (!email) {
    redirect(`/login?error=${encodeURIComponent("Invalid username or email.")}`);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(nextPath.startsWith("/") ? nextPath : "/");
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function resolveEmailFromIdentifier(
  adminClient: ReturnType<typeof createAdminSupabaseClient>,
  identifier: string,
) {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  if (!normalizedIdentifier) {
    return "";
  }

  const { data, error } = await adminClient
    .from("profiles")
    .select("email, username, full_name")
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  const profile = (data ?? []).find((entry) => {
    const username = entry.username?.trim().toLowerCase();
    const fullName = entry.full_name.trim().toLowerCase();
    const emailPrefix = entry.email?.split("@")[0]?.trim().toLowerCase();
    const email = entry.email?.trim().toLowerCase();

    return (
      username === normalizedIdentifier
      || fullName === normalizedIdentifier
      || emailPrefix === normalizedIdentifier
      || email === normalizedIdentifier
    );
  });

  return profile?.email ?? "";
}
