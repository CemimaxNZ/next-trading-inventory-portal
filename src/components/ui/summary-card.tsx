type SummaryCardProps = {
  label: string;
  value: string | number;
  caption: string;
};

export function SummaryCard({ label, value, caption }: SummaryCardProps) {
  return (
    <div className="card-surface bg-gradient-to-br from-white via-white to-brand-50/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="h-2.5 w-2.5 rounded-full bg-brand-400" />
      </div>
      <p className="kpi-value mt-3">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{caption}</p>
    </div>
  );
}
