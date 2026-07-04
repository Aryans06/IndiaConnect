import Link from "next/link";
import { getSchemes } from "@/lib/schemes";
import { getTranslator } from "@/lib/i18n/server";

export default async function Home() {
  const [schemes, t] = await Promise.all([getSchemes(), getTranslator()]);
  const count = schemes.length;

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-12 pt-16 sm:pt-24">
        <p className="eyebrow reveal">{t("home.eyebrow")}</p>
        <h1 className="reveal mt-3 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          {t("home.title1")}
          <span className="text-saffron"> {t("home.title2")}</span>
        </h1>
        <p className="reveal mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
          {t("home.subtitle")}
        </p>
        <div className="reveal mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/finder"
            className="rounded-lg bg-saffron px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-saffron-ink"
          >
            {t("home.cta.check")} →
          </Link>
          <Link
            href="/schemes"
            className="rounded-lg border border-line-strong bg-surface px-6 py-3.5 text-sm font-semibold text-ink transition hover:bg-surface-sunken"
          >
            {t("home.cta.browse")} ({count})
          </Link>
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
          ].map((s) => (
            <div key={s.n} className="bg-surface p-6 sm:p-8">
              <span className="font-mono text-sm font-semibold text-saffron">
                {s.n}
              </span>
              <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">
                {s.t}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories preview */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="font-display text-2xl font-bold tracking-tight">
          What are you looking for?
        </h2>
        <div className="mt-5 flex flex-wrap gap-2.5">
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
              className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-saffron hover:text-saffron-ink"
            >
              {c}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
