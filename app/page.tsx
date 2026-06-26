import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <span className="mb-4 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        Government schemes, made simple
      </span>
      <h1 className="max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
        Find the government schemes you actually qualify for
      </h1>
      <p className="mt-5 max-w-xl text-balance text-lg text-gray-600">
        Answer a few simple questions and instantly see the welfare schemes
        meant for you — with the documents you need and how to apply, in your
        language.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/finder"
          className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          Check my eligibility
        </Link>
        <Link
          href="/schemes"
          className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
        >
          Browse all schemes
        </Link>
      </div>
    </main>
  );
}
