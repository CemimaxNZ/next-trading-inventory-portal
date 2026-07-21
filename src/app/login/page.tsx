import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="brand-panel p-8 md:p-10">
          <div className="inline-flex flex-col">
            <Image
              src="/brand/next-logo-black.png"
              alt="NEXT logo"
              width={1817}
              height={444}
              className="h-auto w-[230px] max-w-full sm:w-[300px]"
              priority
            />
            <span className="mt-5 h-2 w-16 rounded-full bg-slate-950/90" />
            <span className="mt-3 text-[0.72rem] uppercase tracking-[0.34em] text-slate-950/75 sm:text-[0.78rem]">
              Internal Supply Systems
            </span>
          </div>

          <h1 className="mt-8 max-w-xl text-4xl font-semibold tracking-tight text-slate-950">
            Inventory Management Portal
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-900/78">
            Track inventory, manage purchase orders, monitor shipments, and keep every stock movement recorded in one secure internal workspace.
          </p>
        </section>

        <section className="card-surface p-8 md:p-10">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-brand-700">Staff Sign In</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-600">
            Use your internal account to access the portal.
          </p>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {decodeURIComponent(error)}
            </div>
          ) : null}

          <div className="mt-8">
            <LoginForm nextPath={next} />
          </div>
        </section>
      </div>
    </main>
  );
}
