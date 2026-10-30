# Architecture

RoofScan is a single Next.js 16 application written in TypeScript. Pages and
API routes live in the same project and deploy together.

## Routing and languages

- Every page sits under `src/app/[lang]/`, where `lang` is `en` or `hi`. The
  locale is part of the URL, so pages prerender statically and links can be
  shared in either language.
- `src/app/[lang]/layout.tsx` is the root layout. It sets `<html lang>`, loads
  Inter and Noto Sans Devanagari, and builds per-locale metadata.
- `src/proxy.ts` (Next.js proxy, formerly middleware) redirects any path
  without a locale prefix, such as `/`, to the visitor's preferred locale.
  It skips API routes, Next.js internals and files with an extension.
- `src/i18n/negotiate.ts` parses the `Accept-Language` header. It ranks
  entries by q-value, maps regional tags like `hi-IN` to `hi`, and falls back
  to English.

## Translations

- `src/i18n/dictionaries/en.ts` defines the `Dictionary` type. `hi.ts` must
  match it exactly; TypeScript checks the shape and a unit test checks list
  lengths and empty strings.
- Server components call `getDictionary(locale)` and pass strings down as
  props. Translations are never fetched on the client.

## Styling

Tailwind CSS v4. Colours are CSS variables in `src/app/globals.css`, mapped to
utilities through `@theme inline`, with a dark palette under
`prefers-color-scheme: dark`.
