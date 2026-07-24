import {
  createUserAction,
  deleteUserAction,
  updateUserRoleAction,
} from "@/app/actions/users";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { appRoles } from "@/lib/constants";
import type { ProfileRow } from "@/lib/database.types";
import { canManageUsers } from "@/lib/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requirePortalUser } from "@/lib/session";
import { formatDate, formatEnumLabel } from "@/lib/utils";

export default async function UsersPage() {
  const { profile: currentProfile } = await requirePortalUser("admin");
  const canManage = canManageUsers(currentProfile.role);
  const adminClient = createAdminSupabaseClient();

  const [{ data: profilesData }, { data: usersData, error: usersError }] = await Promise.all([
    adminClient.from("profiles").select("*").order("full_name"),
    adminClient.auth.admin.listUsers(),
  ]);

  if (usersError) {
    throw new Error(usersError.message);
  }

  const profiles = (profilesData ?? []) as ProfileRow[];
  const users = usersData.users ?? [];
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  return (
    <>
      <PageHeader
        description="Admins can create staff accounts and assign operational roles."
        title="User Management"
      />

      {canManage ? (
        <SectionCard
          description="Create a new internal user with a starting role."
          title="Add User"
        >
          <form action={createUserAction} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="full_name">
                Full Name
              </label>
              <input className="input-field" id="full_name" name="full_name" required type="text" />
            </div>
            <div>
              <label className="field-label" htmlFor="user-email">
                Email
              </label>
              <input className="input-field" id="user-email" name="email" required type="email" />
            </div>
            <div>
              <label className="field-label" htmlFor="user-password">
                Password
              </label>
              <input className="input-field" id="user-password" name="password" required type="password" />
            </div>
            <div>
              <label className="field-label" htmlFor="role">
                Role
              </label>
              <select className="input-field" defaultValue="viewer" id="role" name="role">
                {appRoles.map((role) => (
                  <option key={role} value={role}>
                    {formatEnumLabel(role)}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <SubmitButton className="btn-primary" pendingLabel="Creating...">
                Create User
              </SubmitButton>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard
        description="Manage role assignments and remove accounts when needed."
        title="Current Users"
      >
        <div className="space-y-4 md:hidden">
          {users.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No users found yet.
            </div>
          ) : users.map((user) => {
            const profile = profileMap.get(user.id);

            return (
              <article
                className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                key={user.id}
              >
                <div>
                  <p className="text-base font-semibold text-slate-950">
                    {profile?.full_name ?? user.user_metadata?.full_name ?? "Unnamed user"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Role</p>
                    <p className="mt-1 text-slate-700">{formatEnumLabel(profile?.role ?? "viewer")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Created</p>
                    <p className="mt-1 text-slate-700">{formatDate(user.created_at)}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Last Sign In</p>
                    <p className="mt-1 text-slate-700">
                      {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "Never"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <form action={updateUserRoleAction} className="flex flex-col gap-2">
                    <input name="id" type="hidden" value={user.id} />
                    <select
                      className="input-field py-2"
                      defaultValue={profile?.role ?? "viewer"}
                      name="role"
                    >
                      {appRoles.map((role) => (
                        <option key={role} value={role}>
                          {formatEnumLabel(role)}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="btn-secondary w-full justify-center" pendingLabel="Saving...">
                      Update Role
                    </SubmitButton>
                  </form>

                  <form action={deleteUserAction}>
                    <input name="id" type="hidden" value={user.id} />
                    <SubmitButton className="btn-danger w-full justify-center" pendingLabel="Deleting...">
                      Delete User
                    </SubmitButton>
                  </form>
                </div>
              </article>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[24%]" />
            </colgroup>
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 pr-4 font-medium text-left">User</th>
                <th className="px-3 pb-3 font-medium text-center">Role</th>
                <th className="px-3 pb-3 font-medium text-center">Created</th>
                <th className="px-3 pb-3 font-medium text-center">Last Sign In</th>
                <th className="px-3 pb-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={5}>
                    No users found yet.
                  </td>
                </tr>
              ) : users.map((user) => {
                const profile = profileMap.get(user.id);

                return (
                  <tr className="border-b border-slate-100 align-top last:border-b-0" key={user.id}>
                    <td className="py-4">
                      <p className="font-medium text-slate-950">
                        {profile?.full_name ?? user.user_metadata?.full_name ?? "Unnamed user"}
                      </p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-3 py-4 text-center text-slate-600">{formatEnumLabel(profile?.role ?? "viewer")}</td>
                    <td className="px-3 py-4 text-center text-slate-600">{formatDate(user.created_at)}</td>
                    <td className="px-3 py-4 text-center text-slate-600">
                      {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "Never"}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-col items-center gap-3">
                        <form action={updateUserRoleAction} className="flex flex-col gap-2 lg:items-center">
                          <input name="id" type="hidden" value={user.id} />
                          <select
                            className="input-field min-w-36 py-2"
                            defaultValue={profile?.role ?? "viewer"}
                            name="role"
                          >
                            {appRoles.map((role) => (
                              <option key={role} value={role}>
                                {formatEnumLabel(role)}
                              </option>
                            ))}
                          </select>
                          <SubmitButton className="btn-secondary justify-center" pendingLabel="Saving...">
                            Update Role
                          </SubmitButton>
                        </form>

                        <form action={deleteUserAction}>
                          <input name="id" type="hidden" value={user.id} />
                          <SubmitButton className="btn-danger justify-center" pendingLabel="Deleting...">
                            Delete User
                          </SubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
