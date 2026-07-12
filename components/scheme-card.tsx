import Link from "next/link";
import type { SchemeListEntry } from "@/lib/schemes";
import type { EligibilityStatus } from "@/lib/eligibility/matcher";
import { StatusStamp } from "./status-stamp";
import { DeadlineBadge } from "./deadline-badge";

export function SchemeCard({
  scheme,
  status,
  reason,
}: {
  scheme: SchemeListEntry;
  status?: EligibilityStatus;
  reason?: string;
}) {
  const place =
    scheme.level === "STATE" ? (scheme.state ?? "State") : "All India";
  return (
    <Link
      href={`/schemes/${scheme.slug}`}
      className="lift group flex flex-col rounded-lg border border-line bg-surface p-5 hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="eyebrow">
          {scheme.category ?? "Scheme"} · {place}
        </span>
        {status && <StatusStamp status={status} />}
      </div>

      <h3 className="mt-3 font-display text-lg font-semibold leading-snug tracking-tight text-ink group-hover:text-saffron-ink">
        {scheme.title}
      </h3>

      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">
        {reason ?? scheme.summary}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
        <DeadlineBadge closeDate={scheme.closeDate} />
        <span className="truncate text-xs text-muted">
          {scheme.ministry ?? "Government of India"}
        </span>
        <span className="shrink-0 text-xs font-semibold text-saffron opacity-0 transition group-hover:opacity-100">
          View →
        </span>
      </div>
    </Link>
  );
}
