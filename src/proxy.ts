import { NextResponse, type NextRequest } from "next/server";
import { locales } from "@/i18n/config";
import { negotiateLocale } from "@/i18n/negotiate";

/**
 * Sends requests without a locale prefix to the visitor's preferred language,
 * e.g. "/" becomes "/hi" for a browser that prefers Hindi.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return;

  const locale = negotiateLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API routes, Next.js internals and any path with a file extension.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
