/**
 * Application-window helpers. Citizens miss schemes they qualify for simply
 * because they miss the deadline, so urgency is treated as first-class.
 */

export type DeadlineTone = "closed" | "urgent" | "soon" | "open" | "none";

export interface DeadlineInfo {
  tone: DeadlineTone;
  /** Short badge text, e.g. "Closes in 5 days". Null when there's nothing to say. */
  label: string | null;
  daysLeft: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getDeadline(
  closeDate: Date | string | null | undefined,
  now: Date = new Date(),
): DeadlineInfo {
  if (!closeDate) return { tone: "none", label: null, daysLeft: null };

  const close = closeDate instanceof Date ? closeDate : new Date(closeDate);
  if (Number.isNaN(close.getTime())) {
    return { tone: "none", label: null, daysLeft: null };
  }

  // Compare whole days so "today" doesn't read as expired at 00:01.
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfClose = new Date(
    close.getFullYear(),
    close.getMonth(),
    close.getDate(),
  ).getTime();
  const daysLeft = Math.round((startOfClose - startOfToday) / DAY_MS);

  if (daysLeft < 0) {
    return { tone: "closed", label: "Applications closed", daysLeft };
  }
  if (daysLeft === 0) {
    return { tone: "urgent", label: "Closes today", daysLeft };
  }
  if (daysLeft <= 7) {
    return {
      tone: "urgent",
      label: `Closes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      daysLeft,
    };
  }
  if (daysLeft <= 30) {
    return { tone: "soon", label: `Closes in ${daysLeft} days`, daysLeft };
  }
  return {
    tone: "open",
    label: `Open until ${close.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
    daysLeft,
  };
}
