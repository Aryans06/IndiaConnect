import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit, clientKey } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows requests up to the limit", () => {
    const key = `k${Math.random()}`;
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
  });

  it("blocks the request that exceeds the limit", () => {
    const key = `k${Math.random()}`;
    rateLimit(key, 2, 60_000);
    rateLimit(key, 2, 60_000);
    const third = rateLimit(key, 2, 60_000);
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfter).toBeGreaterThan(0);
  });

  it("counts down remaining correctly", () => {
    const key = `k${Math.random()}`;
    expect(rateLimit(key, 3, 60_000).remaining).toBe(2);
    expect(rateLimit(key, 3, 60_000).remaining).toBe(1);
    expect(rateLimit(key, 3, 60_000).remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const key = `k${Math.random()}`;
    rateLimit(key, 1, 60_000);
    expect(rateLimit(key, 1, 60_000).ok).toBe(false);

    vi.advanceTimersByTime(60_001);
    const after = rateLimit(key, 1, 60_000);
    expect(after.ok).toBe(true);
    expect(after.remaining).toBe(0);
  });

  it("isolates different keys from each other", () => {
    const a = `a${Math.random()}`;
    const b = `b${Math.random()}`;
    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    // b must be unaffected by a's exhaustion.
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });
});

describe("clientKey", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://x/", { headers });

  it("uses the first ip in x-forwarded-for", () => {
    expect(clientKey(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }), "s")).toBe(
      "s:1.1.1.1",
    );
  });

  it("falls back to x-real-ip", () => {
    expect(clientKey(req({ "x-real-ip": "3.3.3.3" }), "s")).toBe("s:3.3.3.3");
  });

  it("falls back to unknown when no ip headers exist", () => {
    expect(clientKey(req({}), "s")).toBe("s:unknown");
  });

  it("scopes keys so different endpoints don't share a budget", () => {
    const h = { "x-forwarded-for": "1.1.1.1" };
    expect(clientKey(req(h), "assistant")).not.toBe(clientKey(req(h), "write"));
  });
});
