import { redirect } from "next/navigation";
import type { AppRole, ProfileRow } from "@/lib/database.types";
import { hasAtLeastRole } from "@/lib/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function buildFallbackProfile(user: { id: string; email?: string | null; user_metadata?: { full_name?: unknown } }) {
  const fullName =
    typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim().length > 0
      ? user.user_metadata.full_name.trim()
      : (user.email?.split("@")[0] ?? "Portal User");

  return {
    id: user.id,
    email: user.email ?? null,
    full_name: fullName,
    role: "viewer" as const,
  };
}

export async function requirePortalUser(minimumRole?: AppRole) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    const adminClient = createAdminSupabaseClient();
    const fallbackProfile = buildFallbackProfile(user);

    await adminClient.from("profiles").upsert(fallbackProfile);

    const { data: recoveredProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!recoveredProfile) {
      redirect("/login");
    }

    const typedRecoveredProfile = recoveredProfile as ProfileRow;

    if (minimumRole && !hasAtLeastRole(typedRecoveredProfile.role, minimumRole)) {
      redirect("/unauthorized");
    }

    return { supabase, user, profile: typedRecoveredProfile };
  }

  if (error) {
    redirect("/login");
  }

  const typedProfile = profile as ProfileRow;

  if (minimumRole && !hasAtLeastRole(typedProfile.role, minimumRole)) {
    redirect("/unauthorized");
  }

  return { supabase, user, profile: typedProfile };
}
