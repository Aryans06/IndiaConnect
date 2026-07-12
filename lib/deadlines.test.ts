import { describe, it, expect } from "vitest";
import { getDeadline } from "./deadlines";

const NOW = new Date("2026-07-12T10:00:00Z");
const days = (n: number) =>
  new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe("getDeadline", () => {
  it("returns none when there is no close date", () => {
    expect(getDeadline(null, NOW)).toMatchObject({ tone: "none", label: null });
    expect(getDeadline(undefined, NOW).tone).toBe("none");
  });

  it("ignores an unparseable date", () => {
    expect(getDeadline("not-a-date", NOW).tone).toBe("none");
  });

  it("marks a past date as closed", () => {
    const r = getDeadline(days(-1), NOW);
    expect(r.tone).toBe("closed");
    expect(r.label).toBe("Applications closed");
  });

  it("treats the closing day itself as still open (urgent)", () => {
    const r = getDeadline(days(0), NOW);
    expect(r.tone).toBe("urgent");
    expect(r.label).toBe("Closes today");
  });

  it("is urgent within a week, singular for one day", () => {
    expect(getDeadline(days(1), NOW).label).toBe("Closes in 1 day");
    expect(getDeadline(days(5), NOW)).toMatchObject({
      tone: "urgent",
      label: "Closes in 5 days",
    });
    expect(getDeadline(days(7), NOW).tone).toBe("urgent");
  });

  it("is 'soon' between 8 and 30 days", () => {
    expect(getDeadline(days(8), NOW).tone).toBe("soon");
    expect(getDeadline(days(30), NOW).tone).toBe("soon");
  });

  it("is simply open beyond 30 days", () => {
    const r = getDeadline(days(60), NOW);
    expect(r.tone).toBe("open");
    expect(r.label).toMatch(/^Open until/);
  });

  it("accepts a date string", () => {
    expect(getDeadline(days(3).toISOString(), NOW).tone).toBe("urgent");
  });
});
