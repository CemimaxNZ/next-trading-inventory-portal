import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card-surface max-w-lg p-10 text-center">
        <p className="text-sm uppercase tracking-[0.28em] text-brand-700">Access Restricted</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          You do not have permission for this page
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          If you need access, ask an administrator to update your role.
        </p>
        <Link className="btn-primary mt-8" href="/">
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}

