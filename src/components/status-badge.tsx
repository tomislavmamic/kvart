import { STATUSES, STATUS_COLORS } from "@/lib/constants";
import type { Status } from "@/lib/constants";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[status]}`}
    >
      {STATUSES[status]}
    </span>
  );
}
