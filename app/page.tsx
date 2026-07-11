import Link from "next/link";
import { getSchemes } from "@/lib/schemes";
import { getTranslator } from "@/lib/i18n/server";
import { Reveal } from "@/components/reveal";
import { CountUp } from "@/components/count-up";

export default async function Home() {
  const [schemes, t] = await Promise.all([getSchemes(), getTranslator()]);
  const count = schemes.length;

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="aurora">
        <div className="mx-auto max-w-6xl px-5 pb-14 pt-16 sm:pt-24">
          <p className="eyebrow reveal" style={{ ["--d" as string]: "0ms" }}>
            {t("home.eyebrow")}
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            <span className="reveal block" style={{ ["--d" as string]: "80ms" }}>
              {t("home.title1")}
            </span>
            <span
              className="reveal mt-1 block text-saffron-ink"
              style={{ ["--d" as string]: "180ms" }}
            >
              {t("home.title2")}
            </span>
          </h1>
          <p
            className="reveal mt-5 max-w-xl text-lg leading-relaxed text-ink-soft"
            style={{ ["--d" as string]: "300ms" }}
          >
            {t("home.subtitle")}
          </p>
          <div
            className="reveal mt-8 flex flex-wrap items-center gap-3"
            style={{ ["--d" as string]: "420ms" }}
          >
            <Link
              href="/finder"
              className="lift rounded-lg bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-deep"
            >
              {t("home.cta.check")} →
            </Link>
            <Link
              href="/schemes"
              className="lift rounded-lg border border-line-strong bg-surface px-6 py-3.5 text-sm font-semibold text-ink"
            >
              {t("home.cta.browse")} ({count})
            </Link>
          </div>

          {/* Stats strip */}
          <dl
            className="reveal mt-14 grid max-w-lg grid-cols-3 gap-6"
            style={{ ["--d" as string]: "560ms" }}
          >
            <Stat value={count} label="schemes" />
            <Stat value={6} label="languages" />
            <Stat value={0} display="₹0" label="to use" />
          </dl>
        </div>
      </section>

      {/* How it works — a real three-step sequence, so numbering is earned. */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden sm:grid-cols-3">
          {[
            {
              n: "01",
              t: "Tell us about you",
              d: "Age, work, income — just the basics. Skip anything you'd rather not share.",
            },
            {
              n: "02",
              t: "See your matches",
              d: "We check your answers against every scheme's real eligibility rules.",
            },
            {
              n: "03",
              t: "Get the documents",
              d: "Know exactly which papers you need and the steps to apply.",
            },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 90} className="bg-surface p-6 sm:p-8">
              <span className="font-mono text-sm font-semibold text-saffron-ink">
                {s.n}
              </span>
              <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">
                {s.t}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {s.d}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Categories preview */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <Reveal as="h2" className="font-display text-2xl font-bold tracking-tight">
          What are you looking for?
        </Reveal>
        <Reveal delay={80} className="mt-5 flex flex-wrap gap-2.5">
          {[
            "Agriculture",
            "Health",
            "Education",
            "Social Welfare",
            "Housing",
            "Women & Child",
            "Entrepreneurship",
          ].map((c) => (
            <Link
              key={c}
              href={`/schemes?category=${encodeURIComponent(c)}`}
              className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-saffron hover:bg-saffron-soft hover:text-saffron-ink"
            >
              {c}
            </Link>
          ))}
        </Reveal>
      </section>
    </main>
  );
}

function Stat({
  value,
  label,
  display,
}: {
  value: number;
  label: string;
  display?: string;
}) {
  return (
    <div>
      <dt className="font-display text-3xl font-extrabold tracking-tight text-brand">
        {display ?? <CountUp value={value} suffix="+" />}
      </dt>
      <dd className="eyebrow mt-1">{label}</dd>
    </div>
  );
}
