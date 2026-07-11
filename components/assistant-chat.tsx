"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import {
  startListening,
  speak,
  speechRecognitionSupported,
  speechSynthesisSupported,
} from "@/lib/voice";

interface Source {
  slug: string;
  title: string;
  category: string | null;
  eligible?: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  grounded?: boolean;
}

const SUGGESTIONS = [
  "I'm a 65-year-old widow, what can I get?",
  "Schemes for farmers",
  "Help paying for my child's education",
  "I have a disability — what support is there?",
];

export function AssistantChat({ locale }: { locale: Locale }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  function toggleMic() {
    if (listening) return;
    setListening(true);
    const handle = startListening(
      locale,
      (text) => setInput(text),
      () => setListening(false),
    );
    if (!handle) setListening(false);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.answer ?? "Sorry, something went wrong.",
          sources: data.sources ?? [],
          grounded: data.grounded,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry, I couldn't reach the service. Please try again." },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() =>
        endRef.current?.scrollIntoView({ behavior: "smooth" }),
      );
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-saffron text-2xl text-saffron">
            ✦
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
            Ask about any scheme
          </h1>
          <p className="mt-2 max-w-md text-ink-soft">
            Describe your situation in your own words. I&apos;ll point you to
            schemes you may qualify for — grounded in real government data.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm text-ink-soft transition hover:border-saffron hover:text-saffron-ink"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-5 py-6">
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} locale={locale} />
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-brand" />
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-0 flex gap-2 border-t border-line bg-paper/90 py-3 backdrop-blur"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell me about yourself, or ask about a scheme…"
          className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm outline-none transition focus:border-saffron focus:ring-2 focus:ring-saffron/20"
        />
        {speechRecognitionSupported() && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label="Speak your question"
            className={
              listening
                ? "grid w-12 shrink-0 place-items-center rounded-lg border border-saffron bg-saffron-soft text-saffron-ink"
                : "grid w-12 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-soft transition hover:bg-surface-sunken"
            }
          >
            <span aria-hidden className={listening ? "animate-pulse" : ""}>
              🎤
            </span>
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  locale,
}: {
  message: Message;
  locale: Locale;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-ink">
        {message.content}
        {speechSynthesisSupported() && (
          <button
            onClick={() => speak(message.content, locale)}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-saffron-ink hover:underline"
          >
            <span aria-hidden>🔊</span> Listen
          </button>
        )}
        {message.grounded === false && (
          <p className="mt-2 border-t border-line pt-2 font-mono text-[0.65rem] uppercase tracking-wide text-muted">
            Showing matched schemes · AI answers need a Gemini key
          </p>
        )}
      </div>
      {message.sources && message.sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.sources.slice(0, 6).map((s) => (
            <Link
              key={s.slug}
              href={`/schemes/${s.slug}`}
              className={
                s.eligible
                  ? "flex items-center gap-1.5 rounded-lg border border-eligible/40 bg-eligible-soft px-3 py-1.5 text-xs font-medium text-eligible transition hover:border-eligible"
                  : "rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-line-strong hover:text-ink"
              }
            >
              {s.eligible && <span aria-hidden>✓</span>}
              {s.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
