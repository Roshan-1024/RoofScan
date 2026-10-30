# Contributing

## Setup

1. Use Node.js 22.9 or newer.
2. `npm ci`
3. `cp .env.example .env.local` and fill in the values.
4. `npm run dev`

## Before every commit

Run `npm run check`. It must pass: lint, typecheck and unit tests. For
changes that affect pages, also run `npm run build`.

## Commits

- One working feature per commit. Don't commit half-finished work.
- Use [Conventional Commits](https://www.conventionalcommits.org/) prefixes:
  `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- Describe what changed and why in the body, and add an entry to
  `CHANGELOG.md` under "Unreleased".

## Secrets and personal data

- Never commit API keys. Keys live in `.env.local`, which is gitignored.
- Real electricity bills, addresses and measurements are personal data. Keep
  them in `private/`, which is gitignored, and never add them as test
  fixtures. Test fixtures must be synthetic or from public sources.

## Translations

Every user-facing string lives in `src/i18n/dictionaries/`. Add new strings
to both `en.ts` and `hi.ts`. The dictionary test fails if the two files have
different keys or list lengths.
