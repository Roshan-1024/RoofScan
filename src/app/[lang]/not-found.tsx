import Link from "next/link";
import { getDictionary } from "@/i18n";

// The not-found boundary receives no route params, so it shows both languages.
export default function NotFound() {
  const en = getDictionary("en");
  const hi = getDictionary("hi");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      {[
        { locale: "en", dict: en },
        { locale: "hi", dict: hi },
      ].map(({ locale, dict }) => (
        <section key={locale} lang={locale}>
          <h1 className="text-2xl font-bold">{dict.notFound.title}</h1>
          <p className="mt-2 text-muted">{dict.notFound.body}</p>
          <Link href={`/${locale}`} className="mt-3 inline-block font-medium text-primary underline">
            {dict.notFound.back}
          </Link>
        </section>
      ))}
    </main>
  );
}
