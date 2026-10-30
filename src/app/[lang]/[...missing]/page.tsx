import { notFound } from "next/navigation";

/**
 * Unknown paths under a locale, such as /en/pricing, render the localized
 * not-found page inside the site layout instead of the framework's bare 404.
 */
export default function MissingPage() {
  notFound();
}
