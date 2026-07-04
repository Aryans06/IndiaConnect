"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function choose(code: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    startTransition(() => router.refresh());
  }

  const active = LOCALES.find((l) => l.code === current) ?? LOCALES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-sunken hover:text-ink"
        aria-label="Change language"
      >
        <span aria-hidden>🌐</span>
        <span className="hidden sm:inline">{active.native}</span>
      </button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <ul className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg">
            {LOCALES.map((l) => (
              <li key={l.code}>
                <button
                  onClick={() => choose(l.code)}
                  className={
                    l.code === current
                      ? "flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-saffron-ink"
                      : "flex w-full items-center justify-between px-3 py-2 text-sm text-ink-soft transition hover:bg-surface-sunken"
                  }
                >
                  {l.native}
                  <span className="font-mono text-[0.65rem] text-muted">
                    {l.code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
