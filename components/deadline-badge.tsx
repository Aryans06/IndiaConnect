import { getDeadline, type DeadlineTone } from "@/lib/deadlines";

const TONE: Record<Exclude<DeadlineTone, "none">, string> = {
  closed: "border-line bg-surface-sunken text-muted",
  urgent: "border-denied/30 bg-denied-soft text-denied",
  soon: "border-pending/30 bg-pending-soft text-pending",
  open: "border-line bg-surface-sunken text-ink-soft",
};

/** Shows the application window. Renders nothing when there's no close date. */
export function DeadlineBadge({
  closeDate,
  className = "",
}: {
  closeDate: Date | string | null | undefined;
  className?: string;
}) {
  const { tone, label } = getDeadline(closeDate);
  if (tone === "none" || !label) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wide ${TONE[tone]} ${className}`}
    >
      {tone === "urgent" && <span aria-hidden>⏳</span>}
      {label}
    </span>
  );
}
