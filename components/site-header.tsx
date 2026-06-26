import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          {/* Ashoka-chakra-inspired mark: a spoked ring in saffron. */}
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-full border-2 border-saffron text-saffron"
          >
            <span className="block h-3.5 w-3.5 rounded-full border-[2.5px] border-current" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            India<span className="text-saffron">Connect</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link
            href="/schemes"
            className="rounded-md px-3 py-2 text-ink-soft transition hover:bg-surface-sunken hover:text-ink"
          >
            All schemes
          </Link>
          <Link
            href="/finder"
            className="rounded-md bg-saffron px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-saffron-ink"
          >
            Check eligibility
          </Link>
        </nav>
      </div>
    </header>
  );
}
