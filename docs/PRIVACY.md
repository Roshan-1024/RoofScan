# Privacy

RoofScan handles electricity bills and home locations, which are personal
data. These rules apply to every feature.

## What RoofScan stores

Nothing on its servers. There are no accounts, no database and no analytics.
A household's report stays in their browser until they download it.

Progress through the check (the roof snapshot, outline and bill details)
is kept in the browser's `sessionStorage` for that tab only, so a reload
doesn't lose it. It is cleared when the tab closes or the household starts a
new check.

## How personal data is handled

- Bill photos are processed in memory, sent to the Meta Model API for
  reading, and discarded when the request ends. They are never written to
  disk or logs. The browser re-encodes a photo before sending it, which
  removes its metadata, such as the location where it was taken. A bill is
  only sent when the household chooses one under "Read my bill", and the
  form says beforehand that it goes to Meta's Model API.
- RoofScan uses Meta's standard model IDs (for example `muse-spark-1.3`), not
  the cheaper "contributor" variants, which Meta uses to improve its
  products.
- Reports mask the electricity consumer number, showing only its last four
  digits.
- Only the fields needed for the calculation are read from a bill. Names and
  addresses are not extracted.
- A roof photo the household uploads is decoded and scaled in the browser
  and stays there, unless the household chooses "Find my roof" and taps it.
  The editor says beforehand that this sends the photo to Meta's Model API.
- For automatic outlining, the roof image (the satellite snapshot or the
  photo) and the tapped pixel are sent to RoofScan's server and on to Meta
  SAM 3.1, in memory, for that one request. Coordinates are not sent with
  it. The image is not written to disk or logs.
- Bill details typed into the form stay in the browser. The plan is
  calculated there, and the details are never sent to RoofScan's servers.

## Third parties that receive data

| Service | What it receives | Why |
|---|---|---|
| Meta Model API | Roof images (the 400 px satellite snapshot or the household's photo) and the tapped pixel; bill photos; voice recordings | Roof outlines (SAM 3.1), bill reading, transcription |
| Esri World Imagery | Map tile requests, sent directly from the visitor's browser (location and IP address) | Satellite imagery |
| OpenStreetMap Nominatim | Address searches, and pinned coordinates rounded to about 100 m, sent from RoofScan's server, so the visitor's IP address is not shared | Geocoding and confirming the location is in India |
| NASA POWER | Coordinates | Solar resource data |
| Open-Meteo | Coordinates | Rainfall data |

## Caches

To respect rate limits, RoofScan's servers keep recent results in memory:
address searches and region lookups for one day, solar data for a week.
These caches hold search text and coordinates, never bills, photos or
names. They are never written to disk and disappear when the server
restarts.

## In the repository

Real bills, addresses and measurements used for testing stay in `private/`,
which is gitignored. Committed test fixtures are synthetic or public.
