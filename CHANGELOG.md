# Changelog

All notable changes to RoofScan are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Calculation engine (`src/lib/engine/`): system sizing from consumption and
  roof capacity, monthly generation from NASA POWER irradiance, PM Surya Ghar
  central subsidy including special category rates, cost, net-metered
  savings, payback, 25-year savings with degradation, and rainwater yield.
- NASA POWER client with response validation and caching, and
  `GET /api/solar-resource` restricted to locations in India.
- `docs/METHODOLOGY.md` documenting every formula, assumption and source.
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
