# Token Radar

A token launch radar: pre-token protocols ranked by implied airdrop value,
with a six-step farm plan per protocol.

## How it works

`main.ts` (Node 22, standard library only) reads the sealed DefiLlama snapshot
at `/input/snapshot.json`, scores every pre-token protocol with the model in
`lib/model.ts`, and writes:

- `/output/board.json` — the ranked board (all 40 watchlist protocols plus the
  early radar of pre-token protocols below the watchlist floor)
- `/output/data.js` — the same rows, live-token rows, and model constants for
  the dashboard
- `/output/dashboard/` — the static dashboard (no network, no framework)
- `/output/screenshots/` — board, detail, and filtered views
- `/output/dossier.json` — built with `vendor/makefun-board.ts`

## The model (radar-2)

Implied FDV = TVL × the median mcap/TVL ratio of live-token protocols in the
same category (clamped 0.05–1.50, global median as fallback). Implied value =
FDV × airdrop share (5% / 7% / 10% by TVL tier) × launch probability (age,
size, and 7-day growth, clamped 20%–95%). Full formula and constants are
stated in the dashboard's methodology section and in `lib/model.ts`.

## Run locally

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

Implied values are the entry's own estimates, never a promise of a launch or
a price.
