/**
 * Static UI-string dictionaries. English is the source of truth; Hindi is
 * fully translated. Other locales fall back to English chrome while their
 * scheme *content* is still translated on-demand via Bhashini — the words that
 * matter most to a citizen (the actual scheme details) are always localized.
 */
import type { Locale } from "./config";

export const MESSAGES = {
  en: {
    "nav.schemes": "All schemes",
    "nav.assistant": "Ask AI",
    "nav.check": "Check eligibility",
    "nav.account": "My account",
    "home.eyebrow": "For every citizen",
    "home.title1": "The government has a scheme for you.",
    "home.title2": "Let's find it.",
    "home.subtitle":
      "Thousands of welfare schemes exist — pensions, scholarships, housing, healthcare. Answer a few simple questions and see the ones meant for you.",
    "home.cta.check": "Check my eligibility",
    "home.cta.browse": "Browse schemes",
    "assistant.title": "Ask about any scheme",
    "assistant.subtitle":
      "Describe your situation in your own words. I'll point you to schemes you may qualify for.",
    "assistant.placeholder": "Tell me about yourself, or ask about a scheme…",
    "assistant.send": "Ask",
    "common.eligible": "Likely eligible",
    "common.listen": "Listen",
    "common.speak": "Speak",
  },
  hi: {
    "nav.schemes": "सभी योजनाएँ",
    "nav.assistant": "एआई से पूछें",
    "nav.check": "पात्रता जाँचें",
    "nav.account": "मेरा खाता",
    "home.eyebrow": "हर नागरिक के लिए",
    "home.title1": "सरकार के पास आपके लिए एक योजना है।",
    "home.title2": "आइए इसे खोजें।",
    "home.subtitle":
      "हज़ारों कल्याणकारी योजनाएँ मौजूद हैं — पेंशन, छात्रवृत्ति, आवास, स्वास्थ्य। कुछ आसान सवालों के जवाब दें और अपने लिए बनी योजनाएँ देखें।",
    "home.cta.check": "मेरी पात्रता जाँचें",
    "home.cta.browse": "योजनाएँ देखें",
    "assistant.title": "किसी भी योजना के बारे में पूछें",
    "assistant.subtitle":
      "अपनी स्थिति अपने शब्दों में बताएँ। मैं आपको उन योजनाओं की ओर ले जाऊँगा जिनके लिए आप पात्र हो सकते हैं।",
    "assistant.placeholder": "अपने बारे में बताएँ, या किसी योजना के बारे में पूछें…",
    "assistant.send": "पूछें",
    "common.eligible": "संभवतः पात्र",
    "common.listen": "सुनें",
    "common.speak": "बोलें",
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)["en"];

export function translate(locale: Locale, key: MessageKey): string {
  const dict = (MESSAGES as Record<string, Record<string, string>>)[locale];
  return dict?.[key] ?? MESSAGES.en[key];
}
