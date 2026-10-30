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
   the client only) where the household taps their roof. "Measure this roof"
   asks Esri's tile map for the best zoom at that point, stitches a snapshot
   in the browser and looks up the region in parallel.
2. **Outline your roof** (`roof-editor.tsx`): an SVG editor over the
   snapshot. The household taps the roof's corners, then outlines obstacles;
   corners can be dragged. `layoutPanels()` reruns on every change (deferred,
   so dragging stays smooth) and the side panel shows roof area, usable area,
   panel count and the largest system that fits.

## Imagery

`src/lib/imagery/esri.ts` loads Esri World Imagery tiles directly in the
browser. The tile server allows cross-origin reads, so tiles are drawn onto
a canvas without passing through RoofScan's servers. `bestImageryZoom()`
reads the service's tile map to avoid "Map data not yet available"
placeholder tiles. Attribution is shown on the map and under the snapshot.

## Geometry and layout

- `src/lib/geo/tiles.ts`: Web Mercator conversions, metres per pixel and the
  tiles covering a snapshot window.
- `src/lib/geometry/polygon.ts`: area, point-in-polygon, rotation and the
  roof's dominant angle (the rotation with the smallest bounding box).
- `src/lib/layout/panels.ts`: `layoutPanels()`; docs/METHODOLOGY.md
  describes the algorithm.

## Geocoding and rate limiting

- `src/lib/data/nominatim.ts` (server only) calls OpenStreetMap Nominatim
  within its usage policy: an identifying User-Agent, requests spaced at
  least 1.1 s apart per server instance, a one-day cache and search only
  on submit.
- `GET /api/geocode` searches places in India. `GET /api/region` returns
  the state and district for a coordinate, always in English so state
  names match the subsidy rules.
- `src/lib/security/rate-limit.ts` limits each client to 20 requests per
  10 minutes on these routes.
