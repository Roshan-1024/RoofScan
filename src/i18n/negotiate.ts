import { defaultLocale, isLocale, type Locale } from "./config";

/**
 * Picks the best supported locale from an Accept-Language header.
 *
 * Entries are ranked by their q-value (default 1). A regional tag such as
 * "hi-IN" matches its base language "hi". Unsupported or malformed entries
 * are skipped, and the default locale is returned when nothing matches.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;

  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
      return { base: tag.trim().toLowerCase().split("-")[0], q, index };
    })
    .filter((entry) => entry.base && Number.isFinite(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { base } of ranked) {
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
