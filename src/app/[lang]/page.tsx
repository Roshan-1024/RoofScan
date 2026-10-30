import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/i18n";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RoofIllustration } from "@/components/roof-illustration";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <SiteHeader locale={lang} dict={dict} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4">
        <section className="grid items-center gap-10 py-12 md:grid-cols-[1.2fr_1fr] md:py-16">
          <div>
            <p className="text-sm font-semibold text-primary">{dict.hero.eyebrow}</p>
            <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight md:text-5xl">
              {dict.hero.title}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted">{dict.hero.body}</p>
            <p className="mt-4 text-sm font-medium text-muted">{dict.hero.note}</p>
          </div>
          <RoofIllustration className="mx-auto w-full max-w-sm" />
        </section>

        <section aria-labelledby="how-title" className="py-10">
          <h2 id="how-title" className="text-2xl font-bold tracking-tight">
            {dict.how.title}
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-2">
            {dict.how.steps.map((step, index) => (
              <li key={step.title} className="flex gap-4 rounded-2xl border border-border bg-surface p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="benefits-title" className="py-10">
          <h2 id="benefits-title" className="text-2xl font-bold tracking-tight">
            {dict.benefits.title}
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dict.benefits.items.map((item) => (
              <li key={item.title} className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="privacy-title" className="py-10">
          <div className="rounded-2xl border border-border bg-surface-muted p-6">
            <h2 id="privacy-title" className="text-2xl font-bold tracking-tight">
              {dict.privacy.title}
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-muted">
              {dict.privacy.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter dict={dict} />
    </>
  );
}
