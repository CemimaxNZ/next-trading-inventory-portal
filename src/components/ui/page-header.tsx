import Image from "next/image";

type PageHeaderProps = {
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="min-h-[220px] rounded-[2rem] bg-brand-400 shadow-card md:min-h-[300px]">
      <div className="flex flex-col gap-4 px-6 py-7 text-slate-950 md:flex-row md:items-end md:justify-between">
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
    </div>
  );
}
