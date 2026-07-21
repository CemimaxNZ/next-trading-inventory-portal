"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requirePortalUser } from "@/lib/session";
import { userCreateSchema, userRoleSchema } from "@/lib/validators";

export async function createUserAction(formData: FormData) {
  await requirePortalUser("admin");
  const adminClient = createAdminSupabaseClient();
  const parsed = userCreateSchema.parse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    full_name: String(formData.get("full_name") ?? ""),
    role: String(formData.get("role") ?? "viewer"),
  });

  const { data, error } = await adminClient.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.full_name,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Unable to create user.");
  }

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: data.user.id,
    email: parsed.email,
    full_name: parsed.full_name,
    role: parsed.role,
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  revalidatePath("/");
  revalidatePath("/users");
}

export async function updateUserRoleAction(formData: FormData) {
  const { profile } = await requirePortalUser("admin");
  const adminClient = createAdminSupabaseClient();
  const parsed = userRoleSchema.parse({
    id: String(formData.get("id") ?? ""),
    role: String(formData.get("role") ?? "viewer"),
  });

  if (parsed.id === profile.id && parsed.role !== "admin") {
    throw new Error("You cannot remove your own admin access.");
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ role: parsed.role })
    .eq("id", parsed.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/users");
}

export async function deleteUserAction(formData: FormData) {
  const { profile } = await requirePortalUser("admin");
  const adminClient = createAdminSupabaseClient();
  const id = String(formData.get("id") ?? "");

  if (id === profile.id) {
    throw new Error("You cannot delete your own account.");
  }

  const { error } = await adminClient.auth.admin.deleteUser(id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/users");
}
