/**
 * Thin client over the public myScheme backend API that powers
 * www.myscheme.gov.in. This is the same JSON the official site consumes; we
 * use it read-only and cache everything in our own DB so runtime never depends
 * on it. Calls are throttled to stay polite.
 */

const BASE = "https://api.myscheme.gov.in";
// Public key shipped in the myScheme frontend bundle (not a secret).
const API_KEY =
  process.env.MYSCHEME_API_KEY ??
  "tYTy5eEhlu9rFjyxuCr7ra7ACp4dv1RH8gWuHTDc";

const HEADERS = {
  accept: "application/json",
  "x-api-key": API_KEY,
  origin: "https://www.myscheme.gov.in",
  referer: "https://www.myscheme.gov.in/",
};

export interface SchemeListItem {
  slug: string;
  schemeName: string;
  shortTitle?: string;
  level?: string;
  state?: string[];
  category?: string[];
  briefDescription?: string;
}

export interface SchemeDetail {
  slug: string;
  title: string;
  shortTitle?: string;
  ministry?: string | null;
  category?: string | null;
  level: "CENTRAL" | "STATE";
  state?: string | null;
  summary: string;
  benefitsMd?: string | null;
  eligibilityMd?: string | null;
  openDate?: Date | null;
  closeDate?: Date | null;
}

/** myScheme returns ISO date strings or null. */
function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch with retry + exponential backoff. myScheme rate-limits aggressively
 * (429) and occasionally 5xxs; without backoff a bulk ingest loses most of its
 * requests. Honours Retry-After when present.
 */
async function getJson(url: string, attempt = 0): Promise<unknown> {
  const MAX_RETRIES = 5;
  const res = await fetch(url, { headers: HEADERS });

  if (res.status === 429 || res.status >= 500) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(`myScheme ${res.status} after ${MAX_RETRIES} retries`);
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500;
    await sleep(backoff);
    return getJson(url, attempt + 1);
  }

  if (!res.ok) throw new Error(`myScheme ${res.status} for ${url}`);
  return res.json();
}

/** Page through the search API and yield list items. */
export async function* listSchemes(
  opts: { pageSize?: number; max?: number; throttleMs?: number } = {},
): AsyncGenerator<SchemeListItem> {
  const pageSize = opts.pageSize ?? 100;
  const throttleMs = opts.throttleMs ?? 400;
  let from = 0;
  let yielded = 0;
  while (true) {
    const url = `${BASE}/search/v5/schemes?lang=en&q=&keyword=&sort=&from=${from}&size=${pageSize}`;
    const data = (await getJson(url)) as {
      data?: { hits?: { items?: unknown[] } };
    };
    const items = data?.data?.hits?.items ?? [];
    if (!items.length) return;
    for (const raw of items) {
      const f = (raw as { fields?: Record<string, unknown> }).fields ?? {};
      yield {
        slug: String(f.slug ?? ""),
        schemeName: String(f.schemeName ?? ""),
        shortTitle: f.schemeShortTitle as string | undefined,
        level: f.level as string | undefined,
        state: f.beneficiaryState as string[] | undefined,
        category: f.schemeCategory as string[] | undefined,
        briefDescription: f.briefDescription as string | undefined,
      };
      yielded++;
      if (opts.max && yielded >= opts.max) return;
    }
    from += pageSize;
    await sleep(throttleMs);
  }
}

function pickLabel(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v.length ? pickLabel(v[0]) : null;
  }
  if (typeof v === "object" && "label" in v) {
    const label = (v as { label?: unknown }).label;
    return typeof label === "string" ? label : null;
  }
  return null;
}

/** Fetch the full detail for one scheme slug. Returns null if unavailable. */
export async function getSchemeDetail(
  slug: string,
): Promise<SchemeDetail | null> {
  const url = `${BASE}/schemes/v5/public/schemes?slug=${encodeURIComponent(slug)}&lang=en`;
  const data = (await getJson(url)) as {
    data?: { en?: Record<string, unknown> } | null;
  };
  const en = data?.data?.en;
  if (!en) return null;

  const basic = (en.basicDetails ?? {}) as Record<string, unknown>;
  const content = (en.schemeContent ?? {}) as Record<string, unknown>;
  const eligibility = (en.eligibilityCriteria ?? {}) as Record<string, unknown>;

  const levelRaw = (
    typeof basic.level === "object" && basic.level
      ? (basic.level as { value?: string }).value
      : basic.level
  ) as string | undefined;
  const level: "CENTRAL" | "STATE" =
    levelRaw?.toLowerCase() === "central" ? "CENTRAL" : "STATE";

  return {
    slug,
    title: String(basic.schemeName ?? ""),
    shortTitle: basic.schemeShortTitle as string | undefined,
    ministry:
      pickLabel(basic.nodalMinistryName) ??
      pickLabel(basic.nodalDepartmentName) ??
      null,
    category: pickLabel(basic.schemeCategory),
    level,
    state:
      level === "STATE"
        ? pickLabel(basic.state) ?? pickLabel(basic.beneficiaryState)
        : null,
    summary: String(content.briefDescription ?? "").trim(),
    benefitsMd: (content.benefits_md as string | undefined) ?? null,
    eligibilityMd:
      (eligibility.eligibilityDescription_md as string | undefined) ?? null,
    openDate: parseDate(basic.schemeOpenDate),
    closeDate: parseDate(basic.schemeCloseDate),
  };
}
