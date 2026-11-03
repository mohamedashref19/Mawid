import type { BookingStatus } from "@/lib/api";
import { STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const styles: Record<BookingStatus, string> = {
  pending: "bg-pending/15 text-pending",
  confirmed: "bg-primary/15 text-primary",
  rejected: "bg-destructive/15 text-destructive",
  attended: "bg-attended/15 text-attended",
};

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
        styles[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}
