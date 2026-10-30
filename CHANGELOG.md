# Changelog

All notable changes to RoofScan are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- "Ask about your plan": households speak or type a question in Hindi or
  English, or tap a suggestion, and get a short answer in the same
  language. Speech is recorded in the browser, converted to 16 kHz WAV and
  transcribed by Muse Voice Transcribe; Muse Spark 1.3 answers from the
  plan, which the server recalculates with RoofScan's own engine. Tools let
  it work out another size ("What if I install 3 kW?") and change the plan
  on screen when asked ("Change my plan to 5 panels"). Questions outside
  solar, the plan, the scheme, net metering and rainwater are declined.
  Messages cover a blocked microphone, unclear audio, busy and failed
  requests.
- `POST /api/ask`: question or WAV recording (checked to be mono 16-bit
  PCM at 16 or 24 kHz, at most 60 s), 3 MB limit, 20 questions per client
  per 10 minutes, daily model cap.
- `npm run eval:assistant`: seven questions about the Pune example plan in
  Hindi, English and Hinglish, checked for language, numbers from the
  engine, tool calls and staying on topic. Recent runs: 7 of 7, about
  US$0.005 per question.

- "Read my bill": a photo or PDF of the electricity bill fills the bill
  form. Muse Spark 1.3 reads the units, charges for the period, fixed
  charges, sanctioned load, connection type, company, consumer number and
  billing period, with strict JSON-schema output; names and addresses are
  never read. RoofScan checks the answer (zod), works out the billing
  months from the printed dates, converts the load to kW and keeps only
  values that hang together. Every filled field is marked "From your bill"
  until it is edited, and documents that aren't electricity bills are
  refused. English and Hindi.
- `POST /api/bill/read`: 8 MB body limit, 10 readings per client per 10
  minutes, counted against the daily model cap; 503 without an API key.
- Photos are turned upright, shrunk to 2,000 px and re-encoded in the
  browser before upload, which also strips their location metadata.
- `npm run eval:bills`: reads 16 synthetic documents (bills in seven
  languages, phone-style photos, PDFs, and two documents that must be
  refused) with the real API and reports accuracy, tokens and cost. Recent
  runs: 97 to 98 of 98 fields and 16 of 16 documents classified, about
  US$0.0055 per bill.

- Automatic roof outlines with Meta SAM 3.1. The roof step opens with the
  tapped roof already outlined from the satellite snapshot ("Finding your
  roof's edges with Meta SAM 3.1…"), and the household checks it and drags
  any corner that's off. "Find my roof" outlines whatever roof is tapped
  next, including on an uploaded photo (only after a tap, since that sends
  the photo to Meta); "Draw by hand" keeps the manual editor. Outlines
  larger than 3,000 m² are rejected as open ground or a large building,
  and those over 1,000 m² come with a note to check them. The plan and the
  report credit SAM when it found the outline.
- `POST /api/roof/outline`: SAM 3.1 point prompt through Meta's Model API,
  with `@meta-sam/parser` for the streamed response. Requests are limited
  to 2 MB, 15 per client per 10 minutes, and a daily cap per server
  instance (`MODEL_DAILY_REQUEST_LIMIT`, default 2000). Without
  `MODEL_API_KEY` the route returns 503 and the editor falls back to
  drawing by hand.
- `maskToOutline()` turns a segmentation mask into at most 12 draggable
  corners, squaring off masks that fill at least 85% of their wall-aligned
  rectangle. Tuned on SAM 3.1 masks of houses in eight Indian cities.

### Security

- Every response now carries a Content-Security-Policy that keeps scripts,
  styles, fonts and requests on RoofScan's own origin (plus Esri imagery)
  and forbids framing, along with `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` headers.
  The `X-Powered-By` header is no longer sent.

### Fixed

- With an outline already drawn, "Draw by hand" only said "Drag a corner to
  adjust it", leaving households who wanted to redraw stuck. It now adds
  that "Start again" draws a new outline.
- File pickers ("Choose a photo", "Take a photo or choose a file") showed no
  focus ring for keyboard users, because the visually hidden input sat
  outside its label. The input is now inside the label, and the label
  shows its focus.
- A crash while rendering showed the framework's English-only "This page
  couldn't load" screen, and reloading brought the same saved step back,
  so damaged progress (for example from an older version) locked the
  household out until the tab was closed. A bilingual error screen now
  offers "Try again" and "Start a new check", which clears saved progress.
- Submitting the bill form with the amount empty also showed "Fixed charges
  must be less than the bill amount" under the empty, optional fixed
  charges field. That check now runs only once the amount is valid.
- On phones the monthly generation chart was scaled down with the screen,
  shrinking its axis and month labels to about 5 px. The chart now draws at
  its measured width, keeping text at 11 px, and labels every other month
  when space is short.
- Unknown addresses such as `/en/pricing` showed the framework's bare 404
  page with no language set. They now show RoofScan's not-found page in
  the site layout, still with a 404 status.
- The language switch link's accessible name ("Switch language") did not
  include its visible text ("English" or "हिन्दी"), so voice control users
  could not activate it by saying what they saw. The name now reads, for
  example, "Switch language: हिन्दी".

- Locations outside India could be checked. The India bounding box also
  covers parts of Pakistan, Nepal, Bhutan, Bangladesh, Sri Lanka and
  Myanmar, so a pin in Lahore or Dhaka received a PM Surya Ghar plan. Each
  pin is now confirmed to be in India by reverse geocoding before the
  household can measure or upload; points at sea are rejected, and the map
  is kept to the area around India.
- The satellite map showed Esri's "Map data not yet available" tiles when
  zoomed in where Esri has no imagery at that level, as in much of rural
  India. The map now checks the service's tile map as the view changes and
  enlarges the sharpest real imagery instead.

### Added

- `/robots.txt`, allowing pages and excluding the API.
- Eligibility rules from MNRE's operational guidelines: households that
  already received a rooftop subsidy enter that capacity and get CFA only
  for the balance up to 3 kW; the application guide says panels must be
  DCR (made in India from Indian-made cells) and that the scheme ends on
  31 March 2027.
- "Use my own roof photo" for places where satellite imagery is too coarse:
  the household uploads a top-down photo (EXIF orientation respected,
  fitted into an 800 px square), marks a line of known length in metres or
  feet to set the scale, and continues with the same outline editor. The
  photo stays in the browser; the report credits "Your photo" instead of
  Esri.
- `RoofSnapshot.source` records whether the image is Esri imagery or an
  upload; saved sessions from before default to Esri.
- Application guide on the plan: the details to enter on the official
  PM Surya Ghar portal (state, DISCOM, masked consumer number, system size,
  sanctioned load), the seven official steps from registration to subsidy,
  the documents to keep ready, and a link to the portal.
- Printable report: "Download report (PDF)" opens the browser's print
  dialog with a two-page A4 report covering the roof with its panels, the
  recommended system, cost and savings, bill summary, monthly generation,
  rainwater, the application guide and assumptions, in English or Hindi.
  The consumer number is masked.
- Roof figure zoomed to the roof, on the plan and in the report.
- Progress is kept in `sessionStorage`, so a reload keeps the household's
  place; "Start a new check" clears it.
- "Your electricity bill" step: units, billing period, amount, fixed
  charges, sanctioned load, connection type, DISCOM, consumer number and
  household size, validated in the browser. Yearly use and the price per
  unit (without fixed charges) are derived from it, with a warning for
  implausible tariffs.
- "Your solar plan" step: recommended system adjustable panel by panel,
  cost before and after the PM Surya Ghar subsidy (special category rates
  by state, none for non-residential connections), first-year and 25-year
  savings, payback, a sanctioned-load warning, and a monthly generation
  chart against monthly use with a table view. Installed cost per kW is
  editable.
- Rainwater estimate from the roof outline and average rainfall, with the
  rainfall figure editable and its source shown.
- `GET /api/rainfall`: average annual rainfall for 2017 to 2024 from the
  ECMWF IFS model via Open-Meteo, cached and rate limited.
- The engine can mark a connection as not eligible for the subsidy.
- Roof check flow at `/[lang]/check`: address search, "use my location" and
  a satellite map to tap the roof; an exact-scale snapshot at the best
  available zoom; and an outline editor for the roof and obstacles with
  draggable corners.
- Automatic panel layout (`layoutPanels()`): 0.6 m edge walkways, 0.5 m
  obstacle clearance, 15° tilt, rows shade-free from 9:00 to 15:00 on the
  winter solstice, portrait and landscape both tried. Shows roof area,
  usable area, panel count and the largest system that fits.
- Esri World Imagery loaded directly in the browser, using the service's
  tile map to skip zoom levels without imagery.
- `GET /api/geocode` and `GET /api/region`, backed by OpenStreetMap
  Nominatim within its usage policy, with per-client rate limiting.
- "Check my roof" button on the landing page; the language switch now stays
  on the current page.
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
