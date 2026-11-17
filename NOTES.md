# Token Radar — build notes

## Decisions
- Model "radar-2" (original, not the starter's TVL×0.25): implied FDV from the
  median mcap/TVL of live-token protocols in the same category (n>=3, else
  global median; clamped 0.05–1.50), × airdrop share (5% ≥$1B, 7% ≥$100M,
  10% below) × launch probability (base 30% + age ≤25% + size ≤20% + growth
  ≤10%, clamped 20–95%). All inputs from the snapshot only; no names hardcoded.
- Board: all 40 watchlist slugs + every other rankable pre-token protocol
  (no token on record, not CEX, name not version-marked, not a wrapped/
  staked/bridged product) = 203 rows expected. First run (289 rows) put
  base-bridge / coinbase-bridge / WBTC on top — wrapped and bridged products
  of tokens that already trade are not launches, so isRankable now mirrors
  the watchlist rule's exclusion (categories Bridge, Canonical Bridge, Cross
  Chain Bridge, Liquid Staking, Liquid Restaking, Restaked BTC, CEX; names
  with a whole word wrapped/staked/staking or an exchange prefix; version
  markers). All 40 watchlist slugs still pass the filter.
- Farm plans: 6 steps each, category-specific core + weekly actions, capital
  $50–$500 by TVL tier, gas priced by chain (Ethereum $6–12, Solana <$0.10,
  other chains $1–3), hold 30–90 days by age.
- Dashboard: dark radar-room theme (ink #e8eef4 on #0b0f14, green accent),
  static index.html shell + app.js rendering. Sortable columns, search,
  category + chain filters, All / Watchlist / Live tokens tabs, sticky detail
  panel (not a dialog, so screenshots capture it), methodology section with
  the formula and constants in plain text. data.js rows carry farm_steps so
  the detail view renders the same plan board.json carries.
- Dashboard source budget: html ~0.5KB + css ~9.5KB + js ~21KB ≈ 31KB, well
  under the 64KB judge cap.

## Progress
- 2026-11-17: read RULES.txt, competition.yaml, starter main.ts/model.ts/
  dashboard, snapshot stats (758 protocols, 40 watchlist, 342 pre-token,
  global median mcap/TVL 0.169). Wrote lib/model.ts, main.ts, dashboard
  (index.html, app.css, app.js), LICENSE, README.md, .makefun/owner.json.
- TODO: sync to VM, copy vendor/makefun-board.ts byte-for-byte, run twice +
  diff, write gate checker, screenshot script (playwright-core), verify all
  7 gate rows, iterate.

## Screenshot fix (2026-11-17, fix agent)
- ROOT CAUSE: tools/shoot.mjs reused ONE Playwright page and called page.goto()
  with URLs differing only in the hash fragment (#p=..., #category=...). That is
  a same-document navigation: the page never reloads, the dashboard IIFE never
  re-runs, readHash() never sees the new hash, so all 3 shots showed the
  identical plain board view. Second bug: the detail default slug was "aave",
  a live-token protocol, not a board row, so its detail panel would be empty.
- FIX shoot.mjs: fresh page per shot (full reload, hash applied on load);
  default top slug = "steakhouse-financial" (rank 1); in-page assertions
  before each shot (board: detail "Select a protocol", 197 rows; detail:
  panel opens for the slug; filtered: category select "Dexs", 21 rows shown).
  Old shoot.mjs kept as tools/shoot.mjs.bak-20261117.
- SECOND BUG (found while viewing the new detail shot): the detail panel said
  "recomputes this row as $14.5M, which differs from the board — the data
  would be stale." Root cause: the stored category_ratio / launch_probability
  are rounded to 4dp, so a recompute from them lands within ~0.03% (max
  0.031% over 194/197 rows) of the stored value, and the strict === check
  failed. The model values are correct; only the check was too strict.
  FIX dashboard/app.js only (no model/board change): agreement = within
  0.1% relative (max(1, 0.001 * value)). Detail now reads "the same number
  the board carries." Original app.js kept at ../app.js.orig-20261117.
- Also removed the 3 solid-colour placeholder PNGs (gen-placeholder.mjs) from
  entry/screenshots/; the entry now holds EXACTLY the 3 real JPEGs.
- VERIFIED: main.ts run twice (out3, out4) byte-identical (deterministic);
  gate-check on out3: ALL 7 ROWS PASS (dashboard 3 files/31,530 bytes, board
  197 rows, coverage 40/40, farm steps OK, 3 screenshots, dossier 461,773
  bytes, text 31,760 chars, identical to rebuild). vendor/makefun-board.ts
  still byte-identical to the kit starter copy (md5 5ba220c2...).
- Final screenshots (all 1440x900 JPEG, distinct md5):
  1-board.jpg 103,398 B b3ad89ee7b1defb8d653f1b8159caf3f
  2-detail.jpg 119,388 B c0efb28d1a82178882484fe19f93386d
  3-filtered.jpg 98,892 B be085e22c806a99c61670d1bfa38ddea
