/**
 * Server-side locale helpers: read the current locale from the cookie and get a
 * bound translator for UI strings.
 */
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { translate, type MessageKey } from "./messages";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getTranslator(): Promise<
  ((key: MessageKey) => string) & { locale: Locale }
> {
  const locale = await getLocale();
  const t = ((key: MessageKey) => translate(locale, key)) as ((
    key: MessageKey,
  ) => string) & { locale: Locale };
  t.locale = locale;
  return t;
}
