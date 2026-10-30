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
- Unknown paths under a locale, such as `/en/pricing`, match
  `src/app/[lang]/[...missing]/page.tsx`, which calls `notFound()`. The
  localized not-found page then renders inside the root layout with a 404
  status and the right `<html lang>`, instead of the framework's bare 404.
- `src/app/[lang]/error.tsx` catches pages that crash while rendering. It
  offers "Try again" and "Start a new check"; the second also clears saved
  progress, so a saved step that no longer renders can't return on every
  reload. Its text lives in `src/i18n/error-messages.ts`, apart from the
  dictionaries, to keep the boundary small.
- `src/app/robots.ts` serves `/robots.txt`, allowing pages and excluding the
  API.

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

## Calculation engine

`src/lib/engine/` holds pure functions with no I/O, so the same code runs on
the server and in the browser and is fully unit-tested.

- `assumptions.ts`: every constant, with its source.
- `subsidy.ts`: PM Surya Ghar central subsidy, including the special
  category rates.
- `solar.ts`: `planSolar()` sizes the system, then works out generation,
  cost, subsidy, savings, payback and lifetime savings.
- `rainwater.ts`: litres a year the roof can collect.

docs/METHODOLOGY.md explains the formulas.

## External data

- `src/lib/data/nasa-power.ts` (server only) fetches monthly irradiance from
  NASA POWER, validates the response with zod, rejects NASA's fill value, and
  caches results in memory per 0.05° grid cell for seven days.
- `GET /api/solar-resource` exposes it to the browser. It accepts only
  coordinates inside India and returns 502 when NASA POWER is unavailable.

## Roof check flow

`/[lang]/check` renders `CheckFlow`, a client component that steps the
household through the check. Each step is its own component in
`src/components/check/`.

1. **Find your house** (`find-house.tsx`): address search, "use my
   location", and a Leaflet satellite map (`satellite-map.tsx`, loaded on
   the client only, kept to the area around India) where the household taps
   their roof. Each pin is checked: outside India's bounding box it is
   rejected at once; inside it, `GET /api/region` must confirm country code
   `in`, which also supplies the state for the subsidy rate. Measuring and
   uploading stay disabled until the pin is confirmed, and answers for pins
   that have since moved are ignored. "Measure this roof"
   asks Esri's tile map for the best zoom at that point, stitches a snapshot
   in the browser and looks up the region in parallel. "Use my own roof
   photo" (`roof-upload.tsx`) instead takes a top-down photo, fits it into a
   square, and sets the scale from a line the household marks on something
   of known length (`src/lib/imagery/upload.ts`). The pin still supplies the
   location for sunlight, rainfall and the subsidy state. Either way the
   next steps receive the same `RoofSnapshot`, tagged with its source.
2. **Outline your roof** (`roof-editor.tsx`): an SVG editor over the
   snapshot with three modes. **Find my roof** sends the image and a tapped
   point to `POST /api/roof/outline`, where Meta SAM 3.1 outlines the roof
   (see "Automatic roof outline" below). A satellite snapshot is centred on
   the spot the household tapped on the map, so it is outlined as soon as
   the editor opens; an uploaded photo waits for a tap, because outlining
   sends it to Meta. **Draw by hand** takes the roof's corners one tap at a
   time. **Obstacles** outlines what panels can't cover. Corners can always
   be dragged. `layoutPanels()` reruns on every change (deferred, so
   dragging stays smooth) and the side panel shows roof area, usable area,
   panel count and the largest system that fits. `RoofState.outlinedBy`
   records whether SAM or the household drew the outline, and the plan and
   report credit SAM when it did.
3. **Your electricity bill** (`bill-form.tsx`): units, billing period,
   amount, fixed charges, sanctioned load, connection type, DISCOM, consumer
   number and household size, validated with the zod schema in
   `src/lib/bill.ts`. "Read my bill" fills these from a photo or PDF of the
   bill (see "Bill reading" below); each filled field is marked "From your
   bill" until the household edits it.
4. **Your solar plan** (`plan-view.tsx`): runs `planSolar()` in the browser
   and shows the recommended system (adjustable panel by panel), cost and
   subsidy, savings and payback, monthly generation against monthly use
   (`monthly-chart.tsx`, with a table view), and the rainwater estimate.
   Installed cost per kW and rainfall can be edited.

   Below the numbers: the application guide (`apply-guide.tsx`) with the
   details to enter on the PM Surya Ghar portal and the official steps, and
   a button that prints the report.

`CheckFlow` holds the state of all four steps, so going back keeps what the
household entered. Solar and rainfall data start loading as soon as a roof
is chosen, so they are usually ready by the time the bill is entered. Bill
details never leave the browser.

### Progress and the report

- Progress (step, snapshot, outline, bill) is saved to `sessionStorage`, so
  a reload keeps it. It stays in that tab and is cleared when the tab
  closes. "Start a new check" resets it. `CheckFlowLoader` renders the flow
  on the client only, which lets it read storage while initialising. The
  storage key and `clearSavedProgress()` live in `saved-progress.ts`, which
  the error boundary also uses.
- `monthly-chart.tsx` measures its own width with a `ResizeObserver` and
  draws at that size, so axis text stays at its real size on phones instead
  of being scaled down with the SVG. Below 32 px per month it labels every
  other month; the table view lists all twelve.
- The report (`report-sheet.tsx`) is hidden on screen and shown only when
  printing, while the site header, footer and the interactive plan are
  hidden. "Download report (PDF)" opens the browser's print dialog, whose
  "Save as PDF" keeps Hindi letters joined correctly. Print styles force
  the light palette, A4 pages and exact colours. The report fits on two A4
  pages and shows the consumer number masked.
- `roof-figure.tsx` draws the roof, obstacles and the chosen panels, zoomed
  to the roof, on the plan and in the report.

## Automatic roof outline

- `POST /api/roof/outline` takes `{ image, size, point }`: a square roof
  image as a data URL, its size in pixels, and the tapped point. It checks
  the body (at most 2 MB, read with `readJsonBody()` from
  `src/lib/security/body.ts`, which stops reading once the limit is passed),
  allows 15 requests per client per 10 minutes, and counts each request
  against `modelBudget`, a daily cap per server instance
  (`MODEL_DAILY_REQUEST_LIMIT`, default 2000).
- `src/lib/meta/client.ts` (server only) configures the OpenAI SDK for
  Meta's Model API (`https://api.meta.ai/v1`) and names the standard model
  IDs. Without `MODEL_API_KEY` the route answers 503 and the editor falls
  back to drawing by hand.
- `src/lib/meta/sam.ts` builds a SAM 3.1 point prompt with
  `buildObjectPrompt()` from `@meta-sam/parser`, streams the Responses API
  answer through `parseImageStream()`, and decodes the mask with
  `decodeMaskToRaster()`. HTTP failures and unreadable responses become
  `SegmentationError` (502 from the route).
- `src/lib/segmentation/outline.ts` turns the mask into corners a household
  can drag: d3-contour traces the regions, the one under the tapped point
  (or else the largest) is kept, a mask that fills at least 85% of its
  wall-aligned rectangle becomes that rectangle, and anything else is
  simplified with Douglas–Peucker (about 1 m tolerance), with corners
  closer than about 2.5 m merged and at most 12 kept. All sizes scale with
  the image, so they mean the same on a 400 px snapshot and an 800 px photo.
- The editor shows SAM's outline only after sanity checks: more than
  3,000 m² is treated as open ground or a large building and not used, and
  more than 1,000 m² comes with a note to check it. Answers that arrive
  after the household has moved on (switched to drawing by hand, undone or
  started again) are ignored. A 429 shows "busy", and any other failure
  switches to drawing by hand.

## Bill reading

- In the browser, `prepareBillFile()` (`src/lib/bill-reading/file.ts`)
  turns a photo upright, shrinks it to at most 2,000 px on its long edge
  and re-encodes it as JPEG, which also drops its metadata (such as where
  it was taken). PDFs up to 5 MB are sent as they are.
- `POST /api/bill/read` takes `{ file }` (a JPEG, PNG, WebP or PDF data
  URL), limits the body to 8 MB and each client to 10 readings per 10
  minutes, and counts against the daily model cap.
- `src/lib/meta/read-bill.ts` (server only) sends the bill to Muse Spark 1.3
  through Chat Completions: images as `image_url` parts, PDFs as `file`
  parts. It asks for strict JSON-schema output with low reasoning effort.
  The schema, the instructions for each field and the checks live in
  `src/lib/bill-reading/extract.ts`.
- The answer is validated with zod; an impossible value (negative units,
  an unknown load unit) becomes null rather than failing the reading.
  `toBillPrefill()` then derives the billing months from the printed dates
  when there are any, converts the load to kW, drops fixed charges that
  aren't less than the bill, and returns only the values that hang
  together. Names and addresses are never requested.
- `npm run eval:bills` (`accuracy.eval.ts`, its own Vitest config) reads the
  synthetic bills in `__fixtures__` with the real API and prints a table of
  results, tokens and cost. It is not part of `npm test`.

## Imagery

`src/lib/imagery/esri.ts` loads Esri World Imagery tiles directly in the
browser. The tile server allows cross-origin reads, so tiles are drawn onto
a canvas without passing through RoofScan's servers. `bestImageryZoom()`
reads the service's tile map to avoid "Map data not yet available"
placeholder tiles. The map does the same: whenever the view settles at
zoom 14 or closer, it asks the tile map for the highest zoom with real
imagery at the centre and loads tiles from that level, enlarging them when
the household zooms in further. Tile-map answers are cached per tile.
Attribution is shown on the map and under the snapshot.

## Geometry and layout

- `src/lib/geo/tiles.ts`: Web Mercator conversions, metres per pixel and the
  tiles covering a snapshot window.
- `src/lib/geometry/polygon.ts`: area, point-in-polygon, rotation and the
  roof's dominant angle (the rotation with the smallest bounding box).
- `src/lib/layout/panels.ts`: `layoutPanels()`; docs/METHODOLOGY.md
  describes the algorithm.

## Rainfall

`src/lib/data/open-meteo.ts` (server only) fetches daily precipitation for
2017 to 2024 from the ECMWF IFS model via Open-Meteo, averages complete years
and caches the result for 30 days per 0.05° cell. `GET /api/rainfall`
exposes it, limited to India and rate limited like the other routes.

## Geocoding and rate limiting

- `src/lib/data/nominatim.ts` (server only) calls OpenStreetMap Nominatim
  within its usage policy: an identifying User-Agent, requests spaced at
  least 1.1 s apart per server instance, a one-day cache and search only
  on submit.
- `GET /api/geocode` searches places in India. `GET /api/region` returns
  the state and district for a coordinate, always in English so state
  names match the subsidy rules.
- `src/lib/security/rate-limit.ts` limits each client per 10 minutes: 20
  searches, 60 region lookups (one per pin drop) and 20 rainfall lookups.

## Security headers

`next.config.ts` sends these headers on every response, and turns off
`X-Powered-By`:

- `Content-Security-Policy`: scripts, styles, fonts and requests stay on
  the site's own origin, except Esri imagery (`img-src` and `connect-src`
  allow `https://server.arcgisonline.com`). Images may also be `data:` and
  `blob:` URLs, for roof snapshots and uploaded photos. Plugins, framing
  (`frame-ancestors 'none'`), other base URLs and form posts elsewhere are
  blocked. Scripts need `'unsafe-inline'` because Next.js inlines small
  scripts; a nonce would force every page to render per request.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and
  `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy`: geolocation (for "Use my location") and microphone
  (for spoken questions) on this origin only; camera, payment and USB off.

HSTS is left to the host, which serves HTTPS.
