import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/i18n";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CheckFlow } from "@/components/check/check-flow";

export async function generateMetadata({ params }: PageProps<"/[lang]/check">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: `${getDictionary(lang).check.title} · RoofScan` };
}

export default async function CheckPage({ params }: PageProps<"/[lang]/check">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <SiteHeader locale={lang} dict={dict} path="/check" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight">{dict.check.title}</h1>
        <CheckFlow locale={lang} dict={dict.check} />
      </main>
      <SiteFooter dict={dict} />
    </>
  );
}
