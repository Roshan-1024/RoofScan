export const locales = ["en", "hi"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** The language each locale's switcher link points to, and its native name. */
export const alternateLocale: Record<Locale, { locale: Locale; nativeName: string }> = {
  en: { locale: "hi", nativeName: "हिन्दी" },
  hi: { locale: "en", nativeName: "English" },
};
