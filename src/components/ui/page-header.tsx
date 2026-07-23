import Image from "next/image";

type PageHeaderProps = {
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex min-h-[220px] flex-col gap-4 rounded-[2rem] bg-brand-400 px-6 py-8 text-slate-950 shadow-card md:min-h-[300px] md:flex-row md:items-end md:justify-between md:px-8 md:py-10">
      <div className="max-w-2xl">
        <Image
          alt="NEXT logo"
          className="block h-auto w-[132px] max-w-full"
          height={444}
          priority
          src="/brand/next-logo-black.png"
          width={1817}
        />
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-slate-800/85">{description}</p>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
