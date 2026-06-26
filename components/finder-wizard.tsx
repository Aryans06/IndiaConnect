"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ATTRIBUTES,
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type AttributeDef,
} from "@/lib/eligibility/attributes";
import type { EligibilityStatus } from "@/lib/eligibility/matcher";
import { StatusStamp } from "./status-stamp";

type ProfileValue = string | number | boolean;
type Profile = Partial<Record<AttributeKey, ProfileValue>>;

interface ResultItem {
  slug: string;
  title: string;
  status: EligibilityStatus;
  reasons: string[];
  summary: string;
  category: string | null;
}

// Order the questionnaire from broadest to most specific.
const STEP_ORDER: AttributeKey[] = [
  "age",
  "gender",
  "occupation",
  "annualIncome",
  "socialCategory",
  "rationCardType",
  "isDisabled",
  "state",
];

export function FinderWizard() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>({});
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const keys = STEP_ORDER.filter((k) => ATTRIBUTE_KEYS.includes(k));
  const total = keys.length;
  const key = keys[step];
  const attr = ATTRIBUTES[key];

  function set(value: ProfileValue | undefined) {
    setProfile((p) => {
      const next = { ...p };
      if (value === undefined || value === "") delete next[key];
      else next[key] = value;
      return next;
    });
  }

  async function submit(finalProfile: Profile) {
    setLoading(true);
    try {
      const res = await fetch("/api/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: finalProfile }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function next() {
    if (step < total - 1) setStep(step + 1);
    else submit(profile);
  }

  function restart() {
    setStep(0);
    setProfile({});
    setResults(null);
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-center">
        <div className="animate-pulse font-display text-xl font-semibold text-ink-soft">
          Matching you to schemes…
        </div>
      </div>
    );
  }

  if (results) {
    return <Results results={results} onRestart={restart} />;
  }

  const current = profile[key];
  const progress = Math.round(((step + (current !== undefined ? 1 : 0)) / total) * 100);

  return (
    <div className="mx-auto max-w-xl">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <span className="eyebrow">
            Question {step + 1} of {total}
          </span>
          <span className="eyebrow">{progress}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full rounded-full bg-saffron transition-all duration-300"
            style={{ width: `${Math.max(progress, 4)}%` }}
          />
        </div>
      </div>

      <div className="reveal" key={key}>
        <h2 className="font-display text-2xl font-bold tracking-tight">
          {attr.question}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Optional — skip anything you'd rather not answer.
        </p>

        <div className="mt-6">
          <QuestionInput
            attrKey={key}
            value={current}
            onChange={set}
            onEnter={next}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => (step === 0 ? null : setStep(step - 1))}
          disabled={step === 0}
          className="text-sm font-semibold text-ink-soft disabled:opacity-30"
        >
          ← Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={next}
            className="text-sm font-semibold text-muted hover:text-ink"
          >
            Skip
          </button>
          <button
            onClick={next}
            className="rounded-lg bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-soft"
          >
            {step < total - 1 ? "Next" : "See my schemes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionInput({
  attrKey,
  value,
  onChange,
  onEnter,
}: {
  attrKey: AttributeKey;
  value: ProfileValue | undefined;
  onChange: (v: ProfileValue | undefined) => void;
  onEnter: () => void;
}) {
  const attr: AttributeDef = ATTRIBUTES[attrKey];

  if (attr.type === "boolean") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Yes", val: true },
          { label: "No", val: false },
        ].map((o) => (
          <OptionButton
            key={o.label}
            active={value === o.val}
            onClick={() => onChange(o.val)}
            label={o.label}
          />
        ))}
      </div>
    );
  }

  if (attr.type === "enum" && attr.options) {
    return (
      <div className="grid gap-2.5 sm:grid-cols-2">
        {attr.options.map((o) => (
          <OptionButton
            key={o.value}
            active={value === o.value}
            onClick={() => onChange(o.value)}
            label={o.label}
          />
        ))}
      </div>
    );
  }

  // number / string → text input
  return (
    <input
      autoFocus
      type={attr.type === "number" ? "number" : "text"}
      inputMode={attr.type === "number" ? "numeric" : "text"}
      value={value === undefined ? "" : String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(undefined);
        onChange(attr.type === "number" ? Number(raw) : raw);
      }}
      onKeyDown={(e) => e.key === "Enter" && onEnter()}
      placeholder={attr.unit ? `Amount in ${attr.unit}` : "Type your answer"}
      className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-lg outline-none transition focus:border-saffron focus:ring-2 focus:ring-saffron/20"
    />
  );
}

function OptionButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded-lg border-2 border-saffron bg-saffron-soft px-4 py-3 text-left font-semibold text-saffron-ink"
          : "rounded-lg border border-line bg-surface px-4 py-3 text-left font-medium text-ink transition hover:border-line-strong"
      }
    >
      {label}
    </button>
  );
}

function Results({
  results,
  onRestart,
}: {
  results: ResultItem[];
  onRestart: () => void;
}) {
  const eligible = results.filter((r) => r.status === "eligible");
  const maybe = results.filter((r) => r.status === "needs_more_info");

  return (
    <div className="mx-auto max-w-2xl reveal">
      <p className="eyebrow">Your results</p>
      <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">
        {eligible.length > 0
          ? `${eligible.length} scheme${eligible.length === 1 ? "" : "s"} look right for you`
          : "Let's refine your matches"}
      </h2>
      <p className="mt-2 text-ink-soft">
        Based on what you told us. This is a guide — confirm details on each
        official website before applying.
      </p>

      {eligible.length > 0 && (
        <div className="mt-8 space-y-3">
          {eligible.map((r) => (
            <ResultRow key={r.slug} r={r} />
          ))}
        </div>
      )}

      {maybe.length > 0 && (
        <>
          <h3 className="mt-10 font-display text-lg font-semibold">
            Might also apply — a few more details needed
          </h3>
          <div className="mt-3 space-y-3">
            {maybe.map((r) => (
              <ResultRow key={r.slug} r={r} />
            ))}
          </div>
        </>
      )}

      {results.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center">
          <p className="font-display text-lg font-semibold">
            No clear matches yet
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Try answering a few more questions, or browse all schemes.
          </p>
        </div>
      )}

      <div className="mt-10 flex gap-3">
        <button
          onClick={onRestart}
          className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold transition hover:bg-surface-sunken"
        >
          Start over
        </button>
        <Link
          href="/schemes"
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-soft"
        >
          Browse all schemes
        </Link>
      </div>
    </div>
  );
}

function ResultRow({ r }: { r: ResultItem }) {
  return (
    <Link
      href={`/schemes/${r.slug}`}
      className="group flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 transition hover:border-line-strong sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="eyebrow">{r.category ?? "Scheme"}</span>
        </div>
        <h4 className="mt-1 font-display font-semibold leading-snug group-hover:text-saffron-ink">
          {r.title}
        </h4>
        <p className="mt-0.5 line-clamp-1 text-sm text-ink-soft">{r.summary}</p>
      </div>
      <StatusStamp status={r.status} className="shrink-0 self-start" />
    </Link>
  );
}
