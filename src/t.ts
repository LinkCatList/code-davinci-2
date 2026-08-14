import { en } from "./i18n/en";
import { ru } from "./i18n/ru";

const dicts = { ru, en } as const;

export type Locale = keyof typeof dicts;
export type MessageKey = keyof typeof ru;

export function isLocale(value: string): value is Locale {
  return value === "ru" || value === "en";
}

export function localeFromTelegram(languageCode: string | undefined): Locale {
  return languageCode?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function t(
  locale: string,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const dict = isLocale(locale) ? dicts[locale] : en;
  let text: string = dict[key] ?? en[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
