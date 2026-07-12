"use client";

import { useState } from "react";
import Link from "next/link";

interface Step {
  order: number;
  instruction: string;
}

/**
 * The "how to apply" list, turned into a checklist a citizen can work through
 * over days. Telling someone the steps and then abandoning them is the gap this
 * closes — progress is saved, so they can come back and pick up where they left.
 */
export function ApplicationSteps({
  slug,
  steps,
  signedIn,
  initialCompleted,
}: {
  slug: string;
  steps: Step[];
  signedIn: boolean;
  initialCompleted: number[];
}) {
  const [completed, setCompleted] = useState<number[]>(initialCompleted);
  const [busy, setBusy] = useState<number | null>(null);

  const done = completed.length;
  const total = steps.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  async function toggle(order: number) {
    if (!signedIn) return;
    const isDone = completed.includes(order);
    const next = isDone
      ? completed.filter((o) => o !== order)
      : [...completed, order].sort((a, b) => a - b);

    setBusy(order);
    setCompleted(next); // optimistic
    try {
      const res = await fetch("/api/applications/steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, order, done: !isDone }),
      });
      const data = await res.json();
      if (Array.isArray(data.completedSteps)) setCompleted(data.completedSteps);
    } catch {
      setCompleted(completed); // roll back
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {signedIn && total > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <span className="eyebrow">
              {allDone ? "All steps done 🎉" : `${done} of ${total} done`}
            </span>
            <span className="eyebrow">{pct}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-eligible transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <ol className="space-y-2">
        {steps.map((s) => {
          const isDone = completed.includes(s.order);
          return (
            <li key={s.order}>
              <button
                onClick={() => toggle(s.order)}
                disabled={!signedIn || busy === s.order}
                aria-pressed={isDone}
                className={`flex w-full gap-3 rounded-lg border p-3 text-left transition ${
                  isDone
                    ? "border-eligible/30 bg-eligible-soft"
                    : "border-line bg-surface"
                } ${signedIn ? "hover:border-line-strong" : "cursor-default"}`}
              >
                <span
                  aria-hidden
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-xs font-semibold transition ${
                    isDone
                      ? "border-eligible bg-eligible text-white"
                      : "border-saffron text-saffron-ink"
                  }`}
                >
                  {isDone ? "✓" : s.order}
                </span>
                <span
                  className={`pt-0.5 ${isDone ? "text-muted line-through" : "text-ink-soft"}`}
                >
                  {s.instruction}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {!signedIn && (
        <p className="mt-3 text-xs text-muted">
          <Link
            href="/account"
            className="font-semibold text-saffron-ink hover:underline"
          >
            Sign in
          </Link>{" "}
          to tick these off and save your progress.
        </p>
      )}
    </div>
  );
}
