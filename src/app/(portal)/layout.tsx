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
  const roleLabel = formatEnumLabel(profile.role);

  return (
    <div className="min-h-screen px-3 py-3 md:px-6 md:py-6">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[280px_minmax(0,1fr)] md:gap-6">
        <aside className="card-surface hidden h-fit p-5 md:sticky md:top-6 md:block">
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
              {roleLabel}
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

        <div className="space-y-4 md:space-y-6">
          <div className="card-surface flex items-center justify-between gap-3 px-4 py-3 md:hidden">
            <div className="min-w-0">
              <Image
                alt="NEXT logo"
                className="h-auto w-[118px]"
                height={444}
                src="/brand/next-logo-black.png"
                width={1817}
              />
              <p className="mt-2 truncate text-xs text-slate-500">Next Inventory</p>
            </div>

            <div className="flex min-w-0 flex-col items-end">
              <p className="truncate text-sm font-semibold text-slate-950">{profile.full_name}</p>
              <span className="mt-2 inline-flex rounded-full bg-brand-100 px-3 py-1 text-[0.7rem] font-semibold text-brand-800">
                {roleLabel}
              </span>
              <form action={logoutAction} className="mt-2">
                <button className="btn-secondary px-3 py-2 text-xs" type="submit">
                  Sign Out
                </button>
              </form>
            </div>
          </div>

          <main className="space-y-4 pb-24 md:space-y-6 md:pb-0">{children}</main>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-100/80 bg-white/95 px-3 pt-3 backdrop-blur md:hidden">
        <div className="mx-auto max-w-7xl pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <SidebarNav mobile role={profile.role} />
        </div>
      </div>
    </div>
  );
}
