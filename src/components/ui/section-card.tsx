import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  description?: string;
  className?: string;
  headerAside?: React.ReactNode;
  children: React.ReactNode;
};

export function SectionCard({
  title,
  description,
  className,
  headerAside,
  children,
}: SectionCardProps) {
  return (
    <section className={cn("card-surface border-brand-100 p-6", className)}>
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-3 h-1.5 w-12 rounded-full bg-brand-400" />
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
        {headerAside ? <div className="shrink-0 md:pt-2">{headerAside}</div> : null}
      </div>
      {children}
    </section>
  );
}
