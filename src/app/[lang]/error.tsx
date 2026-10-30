"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { clearSavedProgress } from "@/components/check/saved-progress";
import { defaultLocale, isLocale } from "@/i18n/config";
import { errorMessages } from "@/i18n/error-messages";

/**
 * Shown when a page crashes while rendering. "Start a new check" also clears
 * saved progress, in case the saved step is what fails to render.
 */
export default function PageError({ retry }: { error: unknown; retry: () => void }) {
  const { lang } = useParams<{ lang: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const locale = isLocale(lang) ? lang : defaultLocale;
  const text = errorMessages[locale];

  function startOver() {
    clearSavedProgress();
    const checkPath = `/${locale}/check`;
    // On the check page itself, rendering again starts from the first step.
    if (pathname === checkPath) retry();
    else router.push(checkPath);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold">{text.title}</h1>
      <p className="text-muted">{text.body}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-primary px-5 py-2 font-semibold text-primary-ink"
        >
          {text.retry}
        </button>
        <button
          type="button"
          onClick={startOver}
          className="rounded-full border border-border bg-surface px-5 py-2 font-medium"
        >
          {text.startOver}
        </button>
      </div>
    </main>
  );
}
