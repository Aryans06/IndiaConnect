/**
 * Deterministic eligibility engine.
 *
 * Given a citizen's (possibly incomplete) profile and a set of schemes with
 * structured rules, decide for each scheme whether the citizen is:
 *   - "eligible"        — every required condition is satisfiable and passes
 *   - "needs_more_info" — would pass on known data, but some referenced
 *                          attributes are missing from the profile
 *   - "not_eligible"    — at least one known condition fails
 *
 * No LLM is involved — results are explainable and reproducible. Each result
 * carries human-readable reasons and the list of missing attributes so the
 * finder can ask precisely the right follow-up questions.
 *
 * Semantics: conditions are AND-ed, EXCEPT conditions sharing an `orGroup`,
 * which are OR-ed within that group. A scheme with no rules is treated as
 * "eligible" (universal/no machine-checkable criteria).
 */
import { getAttribute } from "./attributes";
import type { RuleOperator, RuleValue } from "./rules";

export type EligibilityStatus =
  | "eligible"
  | "needs_more_info"
  | "not_eligible";

export interface RuleLike {
  attribute: string;
  operator: RuleOperator;
  value: RuleValue;
  orGroup?: string | null;
}

export interface SchemeLike {
  id: string;
  slug: string;
  title: string;
  rules: RuleLike[];
}

export type ProfileValue = string | number | boolean | null | undefined;
export type Profile = Record<string, ProfileValue>;

export interface MatchResult {
  schemeId: string;
  slug: string;
  title: string;
  status: EligibilityStatus;
  /** Attributes the rules referenced but the profile didn't provide. */
  missingAttributes: string[];
  /** Plain-language explanations (passing reasons or the failing reason). */
  reasons: string[];
  /** Higher = stronger/more-confident match; used for ranking. */
  score: number;
}

type Outcome = "pass" | "fail" | "unknown";

function humanAttribute(key: string): string {
  return getAttribute(key)?.label ?? key;
}

function formatValue(value: RuleValue): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function asNumber(v: ProfileValue): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

/** Evaluate one rule against the profile. */
function evaluateRule(rule: RuleLike, profile: Profile): Outcome {
  const raw = profile[rule.attribute];
  if (raw === null || raw === undefined || raw === "") return "unknown";

  const { operator, value } = rule;

  switch (operator) {
    case "EQ":
      return looseEq(raw, value) ? "pass" : "fail";
    case "NEQ":
      return looseEq(raw, value) ? "fail" : "pass";
    case "IN":
      return Array.isArray(value) && value.some((v) => looseEq(raw, v))
        ? "pass"
        : "fail";
    case "NOT_IN":
      return Array.isArray(value) && value.some((v) => looseEq(raw, v))
        ? "fail"
        : "pass";
    case "LT":
    case "LTE":
    case "GT":
    case "GTE": {
      const a = asNumber(raw);
      const b = asNumber(value as ProfileValue);
      if (a === null || b === null) return "unknown";
      if (operator === "LT") return a < b ? "pass" : "fail";
      if (operator === "LTE") return a <= b ? "pass" : "fail";
      if (operator === "GT") return a > b ? "pass" : "fail";
      return a >= b ? "pass" : "fail";
    }
    case "BETWEEN": {
      const a = asNumber(raw);
      if (!Array.isArray(value) || value.length !== 2 || a === null) {
        return "unknown";
      }
      const min = asNumber(value[0] as ProfileValue);
      const max = asNumber(value[1] as ProfileValue);
      if (min === null || max === null) return "unknown";
      return a >= min && a <= max ? "pass" : "fail";
    }
    default:
      return "unknown";
  }
}

function looseEq(a: ProfileValue, b: RuleValue): boolean {
  if (typeof b === "boolean") {
    const truthy = a === true || a === "true" || a === 1 || a === "1";
    const falsy = a === false || a === "false" || a === 0 || a === "0";
    return b ? truthy : falsy;
  }
  if (typeof b === "number") {
    const n = asNumber(a);
    return n !== null && n === b;
  }
  // String comparison, case-insensitive.
  return String(a).toLowerCase() === String(b).toLowerCase();
}

/** Combine a group of OR-ed outcomes into a single outcome. */
function combineOr(outcomes: Outcome[]): Outcome {
  if (outcomes.some((o) => o === "pass")) return "pass";
  if (outcomes.some((o) => o === "unknown")) return "unknown";
  return "fail";
}

export function evaluateScheme(
  scheme: SchemeLike,
  profile: Profile,
): MatchResult {
  const base: Omit<MatchResult, "status" | "score"> = {
    schemeId: scheme.id,
    slug: scheme.slug,
    title: scheme.title,
    missingAttributes: [],
    reasons: [],
  };

  if (!scheme.rules.length) {
    return {
      ...base,
      status: "eligible",
      reasons: ["No specific eligibility criteria — open to all."],
      score: 1,
    };
  }

  // Partition into OR-groups (keyed) and standalone AND conditions (each its
  // own implicit group).
  const groups = new Map<string, RuleLike[]>();
  for (const rule of scheme.rules) {
    const key = rule.orGroup ?? `__and_${groups.size}_${rule.attribute}`;
    const list = groups.get(key) ?? [];
    list.push(rule);
    groups.set(key, list);
  }

  const missing = new Set<string>();
  const reasons: string[] = [];
  let anyFail = false;
  let anyUnknown = false;
  let passedConditions = 0;

  for (const [, rules] of groups) {
    const outcomes = rules.map((r) => evaluateRule(r, profile));
    const groupOutcome =
      rules.length > 1 || rules[0].orGroup
        ? combineOr(outcomes)
        : outcomes[0];

    if (groupOutcome === "fail") {
      anyFail = true;
      // Describe the failing requirement.
      const r = rules[0];
      reasons.push(
        rules.length > 1
          ? `Requires one of: ${rules
              .map((x) => `${humanAttribute(x.attribute)} ${formatValue(x.value)}`)
              .join(" / ")}`
          : `${humanAttribute(r.attribute)} must be ${operatorPhrase(r.operator)} ${formatValue(r.value)}`,
      );
    } else if (groupOutcome === "unknown") {
      anyUnknown = true;
      for (const r of rules) {
        if (evaluateRule(r, profile) === "unknown") missing.add(r.attribute);
      }
    } else {
      passedConditions++;
      const r = rules[0];
      reasons.push(
        `${humanAttribute(r.attribute)} ${operatorPhrase(r.operator)} ${formatValue(r.value)} ✓`,
      );
    }
  }

  let status: EligibilityStatus;
  if (anyFail) status = "not_eligible";
  else if (anyUnknown) status = "needs_more_info";
  else status = "eligible";

  // Ranking: confirmed-eligible first, then needs-more-info, then ineligible.
  // Within a tier, more satisfied conditions ranks higher.
  const tier = status === "eligible" ? 1000 : status === "needs_more_info" ? 500 : 0;
  const score = tier + passedConditions * 10 - missing.size;

  return {
    ...base,
    status,
    missingAttributes: [...missing],
    reasons,
    score,
  };
}

function operatorPhrase(op: RuleOperator): string {
  switch (op) {
    case "EQ":
      return "be";
    case "NEQ":
      return "not be";
    case "IN":
      return "be one of";
    case "NOT_IN":
      return "not be one of";
    case "LT":
      return "be under";
    case "LTE":
      return "be at most";
    case "GT":
      return "be over";
    case "GTE":
      return "be at least";
    case "BETWEEN":
      return "be between";
    default:
      return "match";
  }
}

/**
 * Match a profile against many schemes, returning results sorted best-first.
 * By default ineligible schemes are excluded; pass includeIneligible to keep
 * them (useful for "why don't I qualify?" views).
 */
export function matchSchemes(
  schemes: SchemeLike[],
  profile: Profile,
  opts: { includeIneligible?: boolean } = {},
): MatchResult[] {
  const results = schemes.map((s) => evaluateScheme(s, profile));
  const filtered = opts.includeIneligible
    ? results
    : results.filter((r) => r.status !== "not_eligible");
  return filtered.sort((a, b) => b.score - a.score);
}
