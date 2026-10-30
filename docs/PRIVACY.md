# Privacy

RoofScan handles electricity bills and home locations, which are personal
data. These rules apply to every feature.

## What RoofScan stores

Nothing on its servers. There are no accounts, no database and no analytics.
A household's report stays in their browser until they download it.

## How personal data is handled

- Bill photos are processed in memory, sent to the Meta Model API for
  reading, and discarded when the request ends. They are never written to
  disk or logs.
- RoofScan uses Meta's standard model IDs (for example `muse-spark-1.3`), not
  the cheaper "contributor" variants, which Meta uses to improve its
  products.
- Reports mask the electricity consumer number, showing only its last four
  digits.
- Only the fields needed for the calculation are read from a bill. Names and
  addresses are not extracted.

## Third parties that receive data

| Service | What it receives | Why |
|---|---|---|
| Meta Model API | Roof image tiles, bill photos, voice recordings | Segmentation, bill reading, transcription |
| Esri World Imagery | Map tile requests (location and the visitor's IP address) | Satellite imagery |
| OpenStreetMap Nominatim | Address searches and coordinates | Geocoding |
| NASA POWER | Coordinates | Solar resource data |

## In the repository

Real bills, addresses and measurements used for testing stay in `private/`,
which is gitignored. Committed test fixtures are synthetic or public.
