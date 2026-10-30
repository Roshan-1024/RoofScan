import Link from "next/link";
import { alternateLocale, type Dictionary, type Locale } from "@/i18n";
import { Logo } from "./logo";

export function SiteHeader({
  locale,
  dict,
  path = "",
}: {
  locale: Locale;
  dict: Dictionary;
  /** Current path after the locale, so the language switch stays on the same page. */
  path?: string;
}) {
  const other = alternateLocale[locale];

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href={`/${locale}`}
          aria-label={dict.nav.home}
          className="flex items-center gap-2 font-semibold"
        >
          <Logo className="h-7 w-7" />
          <span className="text-lg tracking-tight">RoofScan</span>
        </Link>
        {/* The accessible name keeps the visible language name, so voice control users can say it. */}
        <Link
          href={`/${other.locale}${path}`}
          hrefLang={other.locale}
          className="rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted"
        >
          <span className="sr-only">{dict.nav.switchLanguage}: </span>
          <span lang={other.locale}>{other.nativeName}</span>
        </Link>
      </div>
    </header>
  );
}
