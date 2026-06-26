/**
 * Structured eligibility rule types + validation, shared by:
 *   - the curated seed (rules authored by hand)
 *   - the Gemini normalizer (rules extracted from myScheme text)
 *   - the deterministic matcher (Phase 2)
 *
 * A scheme is eligible when ALL of its AND-conditions pass and, for each
 * `orGroup`, at least ONE condition in that group passes.
 */
import { z } from "zod";
import { ATTRIBUTE_KEYS } from "./attributes";

export const RULE_OPERATORS = [
  "EQ",
  "NEQ",
  "LT",
  "LTE",
  "GT",
  "GTE",
  "IN",
  "NOT_IN",
  "BETWEEN",
] as const;

export type RuleOperator = (typeof RULE_OPERATORS)[number];

// A rule value is a scalar, a list (IN/NOT_IN), or a [min, max] tuple (BETWEEN).
export const ruleValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
]);

export type RuleValue = z.infer<typeof ruleValueSchema>;

export const eligibilityRuleSchema = z
  .object({
    attribute: z.enum(ATTRIBUTE_KEYS as [string, ...string[]]),
    operator: z.enum(RULE_OPERATORS),
    value: ruleValueSchema,
    orGroup: z.string().nullable().optional(),
    rawText: z.string().nullable().optional(),
  })
  .superRefine((rule, ctx) => {
    const isList = rule.operator === "IN" || rule.operator === "NOT_IN";
    const isBetween = rule.operator === "BETWEEN";
    if (isList && !Array.isArray(rule.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${rule.operator} requires an array value`,
      });
    }
    if (isBetween) {
      if (!Array.isArray(rule.value) || rule.value.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "BETWEEN requires a [min, max] tuple",
        });
      }
    }
    if (!isList && !isBetween && Array.isArray(rule.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${rule.operator} requires a scalar value`,
      });
    }
  });

export type EligibilityRuleInput = z.infer<typeof eligibilityRuleSchema>;

export const eligibilityRuleArraySchema = z.array(eligibilityRuleSchema);
