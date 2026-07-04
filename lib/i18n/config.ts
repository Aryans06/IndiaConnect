/**
 * Supported languages. English is the source; the rest are rendered by
 * translating UI strings (static dictionaries) and scheme content (on-demand
 * via Bhashini, cached). Codes are ISO-639-1, matching Bhashini's expectations.
 */
export const LOCALES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "mr", label: "Marathi", native: "मराठी" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export function isLocale(v: string | undefined): v is Locale {
  return Boolean(v && LOCALES.some((l) => l.code === v));
}

export function localeLabel(code: string): string {
  return LOCALES.find((l) => l.code === code)?.native ?? code;
}
