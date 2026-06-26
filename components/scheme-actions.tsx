"use client";

import { useState } from "react";
import Link from "next/link";

type AppStatus = "SAVED" | "IN_PROGRESS" | "APPLIED" | null;

const STATUS_LABELS: Record<"SAVED" | "IN_PROGRESS" | "APPLIED", string> = {
  SAVED: "Saved to apply",
  IN_PROGRESS: "Applying now",
  APPLIED: "Applied",
};

export function SchemeActions({
  slug,
  signedIn,
  initialBookmarked,
  initialStatus,
}: {
  slug: string;
  signedIn: boolean;
  initialBookmarked: boolean;
  initialStatus: AppStatus;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return (
      <div className="rounded-lg border border-line bg-surface-sunken px-4 py-3 text-sm text-ink-soft">
        <Link href="/account" className="font-semibold text-saffron-ink hover:underline">
          Sign in
        </Link>{" "}
        to save this scheme and track your application.
      </div>
    );
  }

  async function toggleBookmark() {
    setBusy(true);
    setBookmarked((b) => !b); // optimistic
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (typeof data.bookmarked === "boolean") setBookmarked(data.bookmarked);
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(next: AppStatus) {
    setBusy(true);
    const prev = status;
    setStatus(next); // optimistic
    try {
      await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, status: next ?? "REMOVE" }),
      });
    } catch {
      setStatus(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={toggleBookmark}
        disabled={busy}
        className={
          bookmarked
            ? "inline-flex items-center gap-1.5 rounded-lg border border-saffron bg-saffron-soft px-3.5 py-2 text-sm font-semibold text-saffron-ink"
            : "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-surface-sunken"
        }
      >
        <span aria-hidden>{bookmarked ? "★" : "☆"}</span>
        {bookmarked ? "Saved" : "Save"}
      </button>

      <div className="inline-flex overflow-hidden rounded-lg border border-line">
        {(["SAVED", "IN_PROGRESS", "APPLIED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => updateStatus(status === s ? null : s)}
            disabled={busy}
            className={
              status === s
                ? "bg-ink px-3 py-2 text-xs font-semibold text-white"
                : "bg-surface px-3 py-2 text-xs font-medium text-ink-soft transition hover:bg-surface-sunken"
            }
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
