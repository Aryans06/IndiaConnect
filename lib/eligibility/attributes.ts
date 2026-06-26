/**
 * Canonical attribute registry — the single source of truth that ties together:
 *   - CitizenProfile fields (what we store about a user)
 *   - EligibilityRule.attribute values (what scheme rules reference)
 *   - the guided finder questionnaire (auto-generated from this, Phase 3)
 *
 * Keeping these in one place means the scraper/Gemini, the matcher, and the
 * finder can never drift apart on attribute names or value types.
 */

export type AttributeType = "number" | "enum" | "boolean" | "string";

export interface AttributeOption {
  value: string;
  label: string;
}

export interface AttributeDef {
  /** Stable key used in EligibilityRule.attribute and CitizenProfile. */
  key: string;
  /** Human question shown in the finder. */
  question: string;
  type: AttributeType;
  /** For enum types: the allowed options. */
  options?: AttributeOption[];
  /** Optional unit hint for number types (shown in UI). */
  unit?: string;
}

export const ATTRIBUTES = {
  age: {
    key: "age",
    question: "How old are you?",
    type: "number",
    unit: "years",
  },
  gender: {
    key: "gender",
    question: "What is your gender?",
    type: "enum",
    options: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
      { value: "other", label: "Other" },
    ],
  },
  state: {
    key: "state",
    question: "Which state/UT do you live in?",
    type: "string",
  },
  annualIncome: {
    key: "annualIncome",
    question: "What is your household's annual income?",
    type: "number",
    unit: "₹",
  },
  occupation: {
    key: "occupation",
    question: "What best describes your occupation?",
    type: "enum",
    options: [
      { value: "farmer", label: "Farmer" },
      { value: "student", label: "Student" },
      { value: "salaried", label: "Salaried worker" },
      { value: "self_employed", label: "Self-employed / business" },
      { value: "daily_wage", label: "Daily-wage / labour" },
      { value: "unemployed", label: "Unemployed" },
      { value: "homemaker", label: "Homemaker" },
      { value: "retired", label: "Retired" },
    ],
  },
  socialCategory: {
    key: "socialCategory",
    question: "Which social category do you belong to?",
    type: "enum",
    options: [
      { value: "GENERAL", label: "General" },
      { value: "OBC", label: "OBC" },
      { value: "SC", label: "SC" },
      { value: "ST", label: "ST" },
    ],
  },
  isDisabled: {
    key: "isDisabled",
    question: "Do you have a disability (Divyang)?",
    type: "boolean",
  },
  rationCardType: {
    key: "rationCardType",
    question: "What type of ration card do you have?",
    type: "enum",
    options: [
      { value: "APL", label: "APL (Above Poverty Line)" },
      { value: "BPL", label: "BPL (Below Poverty Line)" },
      { value: "AAY", label: "Antyodaya (AAY)" },
      { value: "none", label: "No ration card" },
    ],
  },
} as const satisfies Record<string, AttributeDef>;

export type AttributeKey = keyof typeof ATTRIBUTES;

export const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTES) as AttributeKey[];

export function getAttribute(key: string): AttributeDef | undefined {
  return (ATTRIBUTES as Record<string, AttributeDef>)[key];
}
