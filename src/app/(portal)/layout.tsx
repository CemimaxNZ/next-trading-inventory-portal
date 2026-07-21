import Image from "next/image";
import { logoutAction } from "@/app/actions/auth";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { requirePortalUser } from "@/lib/session";
import { formatEnumLabel } from "@/lib/utils";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requirePortalUser();

  return (
    <div className="min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="card-surface h-fit p-5 md:sticky md:top-6">
          <div className="px-2 pt-2">
            <Image
              alt="NEXT logo"
              className="block h-auto w-full"
              height={444}
              src="/brand/next-logo-black.png"
              width={1817}
            />
          </div>

          <div className="mt-6 px-2">
            <p className="text-sm font-semibold text-slate-950">{profile.full_name}</p>
            <p className="mt-1 text-sm text-slate-500">{profile.email}</p>
            <span className="mt-3 inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
              {formatEnumLabel(profile.role)}
            </span>
          </div>

          <div className="mt-5">
            <SidebarNav role={profile.role} />
          </div>

          <form action={logoutAction} className="mt-5">
            <button className="btn-secondary w-full" type="submit">
              Sign Out
            </button>
          </form>
        </aside>

        <main className="space-y-6">{children}</main>
      </div>
    </div>
  );
}
