"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ATTRIBUTES,
  type AttributeKey,
  type AttributeDef,
} from "@/lib/eligibility/attributes";

type Value = string | number | boolean | null;
type Profile = Partial<Record<AttributeKey, Value>>;

const FIELDS: AttributeKey[] = [
  "age",
  "gender",
  "occupation",
  "annualIncome",
  "socialCategory",
  "rationCardType",
  "isDisabled",
  "state",
];

export function ProfileForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(initial);
  const [saving, setSaving] = useState(false);

  function set(key: AttributeKey, value: Value) {
    setProfile((p) => ({ ...p, [key]: value === "" ? null : value }));
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      router.push("/account");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {FIELDS.map((key) => {
        const attr: AttributeDef = ATTRIBUTES[key];
        return (
          <div key={key}>
            <label className="mb-1.5 block text-sm font-semibold">
              {attr.label}
              {attr.unit && (
                <span className="ml-1 font-normal text-muted">
                  ({attr.unit})
                </span>
              )}
            </label>
            <FieldInput
              attr={attr}
              value={profile[key] ?? null}
              onChange={(v) => set(key, v)}
            />
          </div>
        );
      })}

      <div className="flex gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-saffron px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-saffron-ink disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}

function FieldInput({
  attr,
  value,
  onChange,
}: {
  attr: AttributeDef;
  value: Value;
  onChange: (v: Value) => void;
}) {
  if (attr.type === "boolean") {
    return (
      <div className="flex gap-2">
        {[
          { label: "Yes", val: true },
          { label: "No", val: false },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => onChange(o.val)}
            className={
              value === o.val
                ? "rounded-lg border-2 border-saffron bg-saffron-soft px-4 py-2 text-sm font-semibold text-saffron-ink"
                : "rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium transition hover:border-line-strong"
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  if (attr.type === "enum" && attr.options) {
    return (
      <select
        value={value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-saffron focus:ring-2 focus:ring-saffron/20"
      >
        <option value="">Prefer not to say</option>
        {attr.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={attr.type === "number" ? "number" : "text"}
      inputMode={attr.type === "number" ? "numeric" : "text"}
      value={value === null ? "" : String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(null);
        onChange(attr.type === "number" ? Number(raw) : raw);
      }}
      className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-saffron focus:ring-2 focus:ring-saffron/20"
    />
  );
}
