# RoofScan

RoofScan helps Indian households decide whether rooftop solar under
**PM Surya Ghar: Muft Bijli Yojana** makes sense for their home. It measures
the roof from satellite imagery, reads the electricity bill, and works out the
system size, generation, cost after the central subsidy, savings and payback.
It also estimates how much rainwater the same roof could harvest, and prepares
a report and an application checklist.

It is available in English and Hindi.

> RoofScan gives estimates to help households decide. The final system design
> comes from a registered vendor's site survey and the electricity distribution
> company's (DISCOM) approval. RoofScan is an independent project and is not
> affiliated with the Government of India, MNRE or any DISCOM.

Built for the Meta Global AI Developer Hackathon 2026 with Meta's Muse Spark,
SAM 3.1 and Muse Voice Transcribe.

## Status

| Feature | State |
|---|---|
| Bilingual site (English, Hindi) with language detection | Done |
| Solar and rainwater calculation engine, NASA POWER solar data | Done |
| Roof selection on satellite imagery, with an upload fallback | Planned |
| Roof and obstacle segmentation with SAM 3.1 | Planned |
| Electricity bill reading with Muse Spark | Planned |
| Results, application checklist and PDF report | Planned |
| Voice questions with Muse Voice Transcribe | Planned |

[CHANGELOG.md](CHANGELOG.md) records what each change added.

## Getting started

Requirements: Node.js 22.9 or newer and npm.

```bash
npm ci
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Used for |
|---|---|
| `MODEL_API_KEY` | Meta Model API key, used only on the server |
| `NOMINATIM_CONTACT_EMAIL` | Contact address sent to OpenStreetMap Nominatim, as its usage policy requires |

`.env.local` is gitignored. Never commit real keys.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run the TypeScript compiler |
| `npm run test` | Unit tests (Vitest) |
| `npm run check` | Lint, typecheck and test; run before every commit |

## Project structure

```
src/
  app/[lang]/        Pages, rendered per locale (en, hi)
  app/api/           API routes (server only)
  components/        Shared UI components
  i18n/              Locale config, Accept-Language negotiation, dictionaries
  lib/engine/        Solar, subsidy and rainwater calculations (pure functions)
  lib/data/          Clients for external data sources
  lib/geo/           Geographic helpers
  proxy.ts           Redirects unprefixed paths to the preferred locale
docs/                Architecture, privacy and methodology notes
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit and
[docs/METHODOLOGY.md](docs/METHODOLOGY.md) for every formula, assumption and
source behind the numbers.

### API

| Route | Returns |
|---|---|
| `GET /api/solar-resource?lat=&lon=` | Monthly solar irradiance for a location in India (NASA POWER) |

## Privacy

RoofScan stores nothing on its servers and uses no analytics. Bill photos are
processed in memory and discarded. See [docs/PRIVACY.md](docs/PRIVACY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Data and attribution

- Satellite imagery: Esri World Imagery (attribution shown on the map).
- Geocoding: © OpenStreetMap contributors, via Nominatim.
- Solar resource: NASA POWER.

## License

MIT, see [LICENSE](LICENSE). Third-party packages keep their own licenses.
