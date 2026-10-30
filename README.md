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
| Address search, satellite map and roof selection, limited to homes in India | Done |
| Roof outline editor with obstacles and automatic panel layout | Done |
| Upload your own roof photo where satellite imagery is too coarse, with scale calibration | Done |
| Automatic roof outline with Meta SAM 3.1: tap the roof, check and adjust the corners | Done |
| Bill details form, with yearly use and price per unit derived from it | Done |
| Solar plan: system size, cost after subsidy, savings, payback, monthly chart | Done |
| Rainwater estimate from the same roof | Done |
| Electricity bill reading from a photo or PDF with Muse Spark, checked by the household | Done |
| Application guide with the details to enter on the PM Surya Ghar portal | Done |
| Two-page report, saved as PDF from the browser, in English or Hindi | Done |
| Progress kept across a reload, in this browser tab only | Done |
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
| `MODEL_API_KEY` | Meta Model API key, used only on the server. Without it, automatic outlining is off and households draw the roof by hand |
| `MODEL_DAILY_REQUEST_LIMIT` | Optional. Model requests allowed per UTC day on one server instance, across all visitors (default 2000) |
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
| `npm run eval:bills` | Reads the synthetic bills in `src/lib/bill-reading/__fixtures__` with Muse Spark and reports accuracy and cost. Calls the real API: needs `MODEL_API_KEY`, costs about US$0.09 |

## Project structure

```
src/
  app/[lang]/        Pages, rendered per locale (en, hi)
  app/api/           API routes (server only)
  components/        Shared UI components
  i18n/              Locale config, Accept-Language negotiation, dictionaries
  lib/engine/        Solar, subsidy and rainwater calculations (pure functions)
  lib/data/          Clients for external data sources
  lib/geo/           Web Mercator tiles and India bounds
  lib/geometry/      Polygon area, rotation and orientation
  lib/imagery/       Esri World Imagery tiles and roof snapshots (browser)
  lib/layout/        Panel layout on a roof outline
  lib/bill-reading/  Bill reading: schema, instructions, checks; synthetic test bills
  lib/meta/          Meta Model API client, SAM 3.1 and Muse Spark calls (server only)
  lib/segmentation/  Segmentation masks to editable roof outlines
  lib/security/      Rate limits, daily model cap, request body limits
  components/check/  The roof check flow
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
| `GET /api/geocode?q=&lang=` | Up to five places in India matching an address (OpenStreetMap Nominatim) |
| `GET /api/region?lat=&lon=` | State and district for a location in India |
| `GET /api/rainfall?lat=&lon=` | Average annual rainfall for a location in India (ECMWF IFS via Open-Meteo) |
| `POST /api/roof/outline` | Outline of the roof under a tapped point in a roof image (Meta SAM 3.1). Body: `{ image, size, point }` |
| `POST /api/bill/read` | Bill form values read from an electricity bill photo or PDF (Muse Spark 1.3). Body: `{ file }` |

## Privacy

RoofScan stores nothing on its servers and uses no analytics. Roof images
sent for automatic outlining, and bill photos, are processed in memory and
discarded. See [docs/PRIVACY.md](docs/PRIVACY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Data and attribution

- Satellite imagery: Powered by Esri. Imagery: Esri, Maxar, Earthstar
  Geographics, and the GIS User Community (shown on the map and snapshot).
- Geocoding: © OpenStreetMap contributors, via Nominatim.
- Solar resource: NASA POWER.
- Rainfall: Open-Meteo (open-meteo.com), ECMWF IFS model, CC BY 4.0.

## License

MIT, see [LICENSE](LICENSE). Third-party packages keep their own licenses.
`@meta-sam/parser`, which reads SAM 3.1 responses, is distributed by Meta
under the [SAM License](https://github.com/meta-models/meta-sam/blob/main/LICENSE).
