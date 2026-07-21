import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
};

export function SectionCard({
  title,
  description,
  className,
  children,
}: SectionCardProps) {
  return (
    <section className={cn("card-surface border-brand-100 p-6", className)}>
      <div className="mb-5">
        <div className="mb-3 h-1.5 w-12 rounded-full bg-brand-400" />
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
