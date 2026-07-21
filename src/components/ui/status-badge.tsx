import { getStatusTone, formatEnumLabel } from "@/lib/utils";

type StatusBadgeProps = {
  value: string;
};

export function StatusBadge({ value }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(value)}`}>
      {formatEnumLabel(value)}
    </span>
  );
}

