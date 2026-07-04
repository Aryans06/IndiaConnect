/**
 * Browser voice helpers built on the Web Speech API — speech recognition (ASR)
 * and speech synthesis (TTS). These run entirely in the browser with no keys,
 * and support Indian languages in modern Chrome/Edge, which makes voice usable
 * for low-literacy users out of the box. (Bhashini remains the server-side
 * option for pipelines the browser can't do.)
 */
import type { Locale } from "./i18n/config";

/** Map our locale codes to BCP-47 tags for the speech engines. */
export function speechLang(locale: Locale): string {
  const map: Record<Locale, string> = {
    en: "en-IN",
    hi: "hi-IN",
    bn: "bn-IN",
    ta: "ta-IN",
    te: "te-IN",
    mr: "mr-IN",
  };
  return map[locale] ?? "en-IN";
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Read text aloud in the given locale. */
export function speak(text: string, locale: Locale) {
  if (!speechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = speechLang(locale);
  const voice = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang === utter.lang);
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
}

type RecognitionHandle = { stop: () => void };

/**
 * Start one-shot speech recognition. Calls onResult with the transcript.
 * Returns a handle to stop early, or null if unsupported.
 */
export function startListening(
  locale: Locale,
  onResult: (text: string) => void,
  onEnd?: () => void,
): RecognitionHandle | null {
  if (!speechRecognitionSupported()) return null;
  const Ctor =
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
      .SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
      .webkitSpeechRecognition;
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = speechLang(locale);
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (e: SpeechRecognitionEventLike) => {
    const transcript = e.results?.[0]?.[0]?.transcript;
    if (transcript) onResult(transcript);
  };
  recognition.onend = () => onEnd?.();
  recognition.onerror = () => onEnd?.();
  recognition.start();
  return { stop: () => recognition.stop() };
}

// Minimal structural types for the Web Speech API (not in TS lib DOM by default).
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (e: SpeechRecognitionEventLike) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}
interface SpeechRecognitionEventLike {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}
