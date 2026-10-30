# Changelog

All notable changes to RoofScan are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Bilingual site foundation on Next.js 16 (App Router, TypeScript, Tailwind CSS v4).
- Locale routing under `/en` and `/hi`. A proxy sends unprefixed paths to the
  visitor's preferred language using the `Accept-Language` header.
- Typed English and Hindi dictionaries, with a test that keeps Hindi in step
  with English.
- Landing page explaining the product, privacy commitments and an
  independence disclaimer, plus a bilingual 404 page.
- Light and dark design tokens; Inter with Noto Sans Devanagari for Hindi.
- Tooling: ESLint, strict TypeScript, Vitest and an `npm run check` gate.
- Documentation: README, architecture, privacy, contributing guide, MIT
  license and an environment template.
