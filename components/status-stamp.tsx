import type { EligibilityStatus } from "@/lib/eligibility/matcher";

const CONFIG: Record<
  EligibilityStatus,
  { label: string; className: string }
> = {
  eligible: {
    label: "Likely eligible",
    className: "text-eligible bg-eligible-soft",
  },
  needs_more_info: {
    label: "A few more details",
    className: "text-pending bg-pending-soft",
  },
  not_eligible: {
    label: "Not eligible",
    className: "text-denied bg-denied-soft",
  },
};

/** The signature element: an official-looking status "stamp". */
export function StatusStamp({
  status,
  className = "",
}: {
  status: EligibilityStatus;
  className?: string;
}) {
  const { label, className: tone } = CONFIG[status];
  return (
    <span className={`stamp ${tone} ${className}`}>
      <span aria-hidden className="text-[0.85em]">
        {status === "eligible" ? "✓" : status === "needs_more_info" ? "?" : "✕"}
      </span>
      {label}
    </span>
  );
}
