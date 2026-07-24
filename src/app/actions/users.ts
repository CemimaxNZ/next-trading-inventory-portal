"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requirePortalUser } from "@/lib/session";
import {
  deriveInternalEmailFromUsername,
  deriveUsernameFromIdentifier,
  isEmailLike,
} from "@/lib/user-identity";
import { userCreateSchema, userRoleSchema } from "@/lib/validators";

function getUserErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return "Please complete all user fields. Password must be at least 8 characters.";
  }

  if (error instanceof Error) {
    if (
      error.message.includes("duplicate key value violates unique constraint")
      || error.message.includes("already been registered")
      || error.message.includes("User already registered")
      || error.message.includes("profiles_username_key")
      || error.message.includes("profiles_email_key")
    ) {
      return "This email or user name already exists. Please use a different one.";
    }

    if (
      error.message.includes('column "username" of relation "profiles" does not exist')
      || error.message.includes("Could not find the 'username' column of 'profiles' in the schema cache")
    ) {
      return "The database is missing the latest username field update. Please run the latest Supabase SQL, then try again.";
    }

    return error.message;
  }

  return "The user could not be created. Please try again.";
}

function redirectToUsersError(error: unknown) {
  const message = getUserErrorMessage(error);
  redirect(`/users?error=${encodeURIComponent(message)}`);
}

export async function createUserAction(formData: FormData) {
  let createdUserId: string | null = null;

  try {
    await requirePortalUser("admin");
    const adminClient = createAdminSupabaseClient();
    const parsed = userCreateSchema.parse({
      identifier: String(formData.get("identifier") ?? ""),
      password: String(formData.get("password") ?? ""),
      full_name: String(formData.get("full_name") ?? ""),
      role: String(formData.get("role") ?? "viewer"),
    });

    const username = deriveUsernameFromIdentifier(parsed.identifier);
    const email = isEmailLike(parsed.identifier)
      ? parsed.identifier.trim().toLowerCase()
      : deriveInternalEmailFromUsername(username);

    if (!username || !email) {
      throw new Error("Please enter a valid email or username.");
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password: parsed.password,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.full_name,
        username,
      },
    });

    if (error || !data.user) {
      throw new Error(error?.message ?? "Unable to create user.");
    }

    createdUserId = data.user.id;

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: data.user.id,
      email,
      full_name: parsed.full_name,
      username,
      role: parsed.role,
    });

    if (profileError) {
      throw new Error(profileError.message);
    }

    revalidatePath("/");
    revalidatePath("/users");
  } catch (error) {
    if (createdUserId) {
      const adminClient = createAdminSupabaseClient();
      await adminClient.auth.admin.deleteUser(createdUserId);
    }

    redirectToUsersError(error);
  }
}

export async function updateUserRoleAction(formData: FormData) {
  try {
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
  } catch (error) {
    redirectToUsersError(error);
  }
}

export async function deleteUserAction(formData: FormData) {
  try {
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
  } catch (error) {
    redirectToUsersError(error);
  }
}
