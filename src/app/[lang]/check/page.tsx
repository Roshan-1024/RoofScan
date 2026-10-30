import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/i18n";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CheckFlowLoader } from "@/components/check/check-flow-loader";

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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 print:max-w-none print:p-0">
        <h1 className="text-3xl font-bold tracking-tight print:hidden">{dict.check.title}</h1>
        <CheckFlowLoader locale={lang} dict={dict.check} disclaimer={dict.disclaimer} />
      </main>
      <SiteFooter dict={dict} />
    </>
  );
}
