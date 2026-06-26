import { describe, it, expect } from "vitest";
import {
  evaluateScheme,
  matchSchemes,
  type SchemeLike,
  type Profile,
} from "./matcher";

function scheme(rules: SchemeLike["rules"], id = "s1"): SchemeLike {
  return { id, slug: id, title: `Scheme ${id}`, rules };
}

describe("evaluateScheme — single operators", () => {
  const cases: {
    name: string;
    rules: SchemeLike["rules"];
    profile: Profile;
    expected: "eligible" | "needs_more_info" | "not_eligible";
  }[] = [
    {
      name: "EQ pass",
      rules: [{ attribute: "occupation", operator: "EQ", value: "farmer" }],
      profile: { occupation: "farmer" },
      expected: "eligible",
    },
    {
      name: "EQ fail",
      rules: [{ attribute: "occupation", operator: "EQ", value: "farmer" }],
      profile: { occupation: "student" },
      expected: "not_eligible",
    },
    {
      name: "EQ case-insensitive",
      rules: [{ attribute: "gender", operator: "EQ", value: "female" }],
      profile: { gender: "Female" },
      expected: "eligible",
    },
    {
      name: "GTE pass on boundary",
      rules: [{ attribute: "age", operator: "GTE", value: 60 }],
      profile: { age: 60 },
      expected: "eligible",
    },
    {
      name: "GTE fail",
      rules: [{ attribute: "age", operator: "GTE", value: 60 }],
      profile: { age: 59 },
      expected: "not_eligible",
    },
    {
      name: "LTE numeric string coercion",
      rules: [{ attribute: "annualIncome", operator: "LTE", value: 250000 }],
      profile: { annualIncome: "200000" },
      expected: "eligible",
    },
    {
      name: "BETWEEN inside range",
      rules: [{ attribute: "age", operator: "BETWEEN", value: [40, 79] }],
      profile: { age: 50 },
      expected: "eligible",
    },
    {
      name: "BETWEEN on upper boundary",
      rules: [{ attribute: "age", operator: "BETWEEN", value: [40, 79] }],
      profile: { age: 79 },
      expected: "eligible",
    },
    {
      name: "BETWEEN out of range",
      rules: [{ attribute: "age", operator: "BETWEEN", value: [40, 79] }],
      profile: { age: 80 },
      expected: "not_eligible",
    },
    {
      name: "IN match",
      rules: [
        { attribute: "rationCardType", operator: "IN", value: ["BPL", "AAY"] },
      ],
      profile: { rationCardType: "BPL" },
      expected: "eligible",
    },
    {
      name: "IN no match",
      rules: [
        { attribute: "rationCardType", operator: "IN", value: ["BPL", "AAY"] },
      ],
      profile: { rationCardType: "APL" },
      expected: "not_eligible",
    },
    {
      name: "NOT_IN excludes",
      rules: [
        { attribute: "rationCardType", operator: "NOT_IN", value: ["APL"] },
      ],
      profile: { rationCardType: "APL" },
      expected: "not_eligible",
    },
    {
      name: "boolean EQ true",
      rules: [{ attribute: "isDisabled", operator: "EQ", value: true }],
      profile: { isDisabled: true },
      expected: "eligible",
    },
    {
      name: "boolean EQ true with string 'true'",
      rules: [{ attribute: "isDisabled", operator: "EQ", value: true }],
      profile: { isDisabled: "true" },
      expected: "eligible",
    },
    {
      name: "boolean EQ true but false profile",
      rules: [{ attribute: "isDisabled", operator: "EQ", value: true }],
      profile: { isDisabled: false },
      expected: "not_eligible",
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(evaluateScheme(scheme(c.rules), c.profile).status).toBe(
        c.expected,
      );
    });
  }
});

describe("evaluateScheme — missing data", () => {
  it("reports needs_more_info with the missing attribute", () => {
    const r = evaluateScheme(
      scheme([{ attribute: "age", operator: "GTE", value: 60 }]),
      {},
    );
    expect(r.status).toBe("needs_more_info");
    expect(r.missingAttributes).toEqual(["age"]);
  });

  it("empty string counts as missing, not a value", () => {
    const r = evaluateScheme(
      scheme([{ attribute: "occupation", operator: "EQ", value: "farmer" }]),
      { occupation: "" },
    );
    expect(r.status).toBe("needs_more_info");
    expect(r.missingAttributes).toContain("occupation");
  });

  it("a known failure outweighs missing data → not_eligible", () => {
    const r = evaluateScheme(
      scheme([
        { attribute: "age", operator: "GTE", value: 60 },
        { attribute: "rationCardType", operator: "IN", value: ["BPL"] },
      ]),
      { age: 30 }, // age fails; rationCardType unknown
    );
    expect(r.status).toBe("not_eligible");
  });

  it("lists only the truly missing attributes", () => {
    const r = evaluateScheme(
      scheme([
        { attribute: "age", operator: "GTE", value: 60 },
        { attribute: "rationCardType", operator: "IN", value: ["BPL"] },
      ]),
      { age: 70 }, // age passes; rationCardType missing
    );
    expect(r.status).toBe("needs_more_info");
    expect(r.missingAttributes).toEqual(["rationCardType"]);
  });
});

describe("evaluateScheme — AND / OR semantics", () => {
  it("AND requires all conditions", () => {
    const rules: SchemeLike["rules"] = [
      { attribute: "gender", operator: "EQ", value: "female" },
      { attribute: "age", operator: "BETWEEN", value: [40, 79] },
    ];
    expect(
      evaluateScheme(scheme(rules), { gender: "female", age: 50 }).status,
    ).toBe("eligible");
    expect(
      evaluateScheme(scheme(rules), { gender: "male", age: 50 }).status,
    ).toBe("not_eligible");
  });

  it("orGroup passes when any one condition passes", () => {
    const rules: SchemeLike["rules"] = [
      { attribute: "socialCategory", operator: "IN", value: ["SC", "ST"], orGroup: "target" },
      { attribute: "gender", operator: "EQ", value: "female", orGroup: "target" },
    ];
    // Neither SC/ST nor... actually female → passes via gender
    expect(
      evaluateScheme(scheme(rules), {
        socialCategory: "GENERAL",
        gender: "female",
      }).status,
    ).toBe("eligible");
    // Male + general → group fails
    expect(
      evaluateScheme(scheme(rules), {
        socialCategory: "GENERAL",
        gender: "male",
      }).status,
    ).toBe("not_eligible");
  });

  it("orGroup is needs_more_info when no pass but some unknown", () => {
    const rules: SchemeLike["rules"] = [
      { attribute: "socialCategory", operator: "IN", value: ["SC", "ST"], orGroup: "t" },
      { attribute: "gender", operator: "EQ", value: "female", orGroup: "t" },
    ];
    // SC/ST fails (general), gender unknown → group unknown → needs_more_info
    expect(
      evaluateScheme(scheme(rules), { socialCategory: "GENERAL" }).status,
    ).toBe("needs_more_info");
  });

  it("AND of an orGroup and a standalone rule", () => {
    const rules: SchemeLike["rules"] = [
      { attribute: "age", operator: "BETWEEN", value: [18, 40] },
      { attribute: "occupation", operator: "IN", value: ["daily_wage", "self_employed"], orGroup: "worker" },
    ];
    expect(
      evaluateScheme(scheme(rules), { age: 30, occupation: "daily_wage" })
        .status,
    ).toBe("eligible");
    expect(
      evaluateScheme(scheme(rules), { age: 50, occupation: "daily_wage" })
        .status,
    ).toBe("not_eligible");
  });
});

describe("evaluateScheme — no rules", () => {
  it("a scheme with no rules is open to all", () => {
    expect(evaluateScheme(scheme([]), {}).status).toBe("eligible");
  });
});

describe("matchSchemes — ranking & filtering", () => {
  const schemes: SchemeLike[] = [
    scheme([{ attribute: "occupation", operator: "EQ", value: "farmer" }], "eligible-one"),
    scheme([{ attribute: "age", operator: "GTE", value: 60 }], "needs-info"),
    scheme([{ attribute: "occupation", operator: "EQ", value: "student" }], "ineligible-one"),
  ];

  it("excludes ineligible by default and ranks eligible above needs_more_info", () => {
    const results = matchSchemes(schemes, { occupation: "farmer" });
    expect(results.map((r) => r.slug)).toEqual(["eligible-one", "needs-info"]);
    expect(results[0].status).toBe("eligible");
    expect(results[1].status).toBe("needs_more_info");
  });

  it("includeIneligible keeps everything", () => {
    const results = matchSchemes(
      schemes,
      { occupation: "farmer" },
      { includeIneligible: true },
    );
    expect(results).toHaveLength(3);
    expect(results[results.length - 1].status).toBe("not_eligible");
  });
});

describe("evaluateScheme — explanations", () => {
  it("gives a passing reason for satisfied rules", () => {
    const r = evaluateScheme(
      scheme([{ attribute: "age", operator: "GTE", value: 60 }]),
      { age: 65 },
    );
    expect(r.reasons.join(" ")).toMatch(/at least 60/);
  });

  it("gives the failing requirement when ineligible", () => {
    const r = evaluateScheme(
      scheme([{ attribute: "age", operator: "GTE", value: 60 }]),
      { age: 40 },
    );
    expect(r.reasons.join(" ")).toMatch(/at least 60/);
  });
});
