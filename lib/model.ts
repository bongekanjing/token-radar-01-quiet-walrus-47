// Token Radar — value model (lib/model.ts).
//
// One snapshot in, one ranked board out. The board ranks pre-token protocols by the
// implied value of a future airdrop to a farmer, estimated only from the snapshot's
// own figures (TVL, 7-day TVL change, listed_at age) and from the live-token
// protocols in the same snapshot. No protocol name is ever special-cased.
//
// Model "radar-2" (constants in MODEL below):
//
//   1. Category multiple. For each category, take the median mcap/TVL ratio of the
//      live-token protocols in that category (at least 3 of them, else the global
//      median over all live protocols). Clamp the multiple to [0.05, 1.50]: a few
//      categories hold extreme outliers (a tiny TVL with a large cap, or the
//      reverse), and an uncapped multiple would let one odd protocol set the
//      price for a whole category.
//   2. Implied FDV.  fdv = tvl_usd * category_multiple.
//   3. Airdrop share. The slice of FDV a farmer could plausibly capture, by size:
//      TVL >= $1B -> 5%, >= $100M -> 7%, below -> 10%. Bigger protocols spread a
//      launch over more users and a smaller share; smaller ones must be more
//      generous to attract farmers.
//   4. Launch probability. A number in [0.20, 0.95] built from three signals:
//        p = 0.30
//          + 0.25 * min(age_days, 1095) / 1095        (older, still tokenless -> likelier)
//          + 0.20 * min(max(log10(tvl / 5M), 0), 2.6) / 2.6   (bigger -> likelier)
//          + 0.10 * clamp(change_7d, -50, 100) / 100  (growing -> likelier)
//      Age unknown (no listed_at) counts as 365 days; change_7d unknown counts as 0.
//   5. Implied value.  implied = round(fdv * share * p), at least $1.
//
// Rows sort by implied value descending; ties break by slug ascending, so the
// board is fully deterministic. The watchlist is the floor: every watchlist slug
// is ranked, plus every other rankable pre-token protocol (no token on record,
// not a CEX, name not ending in a version marker, and not a wrapped, staked or
// bridged product of a token that already trades), whatever its TVL.
//
// Live-token protocols are never ranked: the board shows the market's own value
// for them instead (see liveRows). Farm plans are derived from the protocol's
// own record — category, chains, TVL, age — never from a hand-kept list.

/** One protocol entry of the sealed snapshot: exactly its ten fields. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model constants, stated in the dashboard's methodology section. */
export interface ModelConstants {
  ratio_min: number;
  ratio_max: number;
  ratio_min_category_n: number;
  share_tier_big: number;
  share_tier_mid: number;
  share_tier_small: number;
  tier_big_usd: number;
  tier_mid_usd: number;
  prob_base: number;
  prob_age_weight: number;
  prob_size_weight: number;
  prob_growth_weight: number;
  prob_min: number;
  prob_max: number;
  prob_age_days: number;
  prob_size_log_max: number;
  growth_floor: number;
  growth_cap: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  ratio_min: 0.05,
  ratio_max: 1.5,
  ratio_min_category_n: 3,
  share_tier_big: 0.05,
  share_tier_mid: 0.07,
  share_tier_small: 0.1,
  tier_big_usd: 1_000_000_000,
  tier_mid_usd: 100_000_000,
  prob_base: 0.3,
  prob_age_weight: 0.25,
  prob_size_weight: 0.2,
  prob_growth_weight: 0.1,
  prob_min: 0.2,
  prob_max: 0.95,
  prob_age_days: 1095,
  prob_size_log_max: 2.6,
  growth_floor: -50,
  growth_cap: 100,
  unknown_age_days: 365,
};

/** The model's version label, shown on the dashboard. */
export const MODEL_VERSION = 'radar-2';

/** Cap on early (non-watchlist) rows: high enough to take every rankable one. */
export const EARLY_ROWS = 260;

/** How many live-token protocols the dashboard's live section carries. */
export const LIVE_ROWS = 24;

/** One farm step: action text, its cost, and its time. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_ratio: number;
    implied_fdv_usd: number;
    airdrop_share: number;
    launch_probability: number;
    growth_pct: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one board row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_fdv_usd: number;
  category_ratio: number;
  airdrop_share: number;
  launch_probability: number;
  farm_steps: string[];
}

/** A live-token protocol, shown with the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_ratio: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Whole days from `listedAt` to `asOf`, clamped at zero; null when absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted numeric array (upper median for even counts). */
function median(sorted: number[]): number {
  return sorted[Math.floor(sorted.length / 2)]!;
}

/**
 * The category multiples: median mcap/TVL of live-token protocols per category,
 * clamped to [ratio_min, ratio_max]; categories with too few live protocols fall
 * back to the global median. Deterministic: categories and ratios are sorted.
 */
export function categoryRatios(protocols: SnapshotProtocol[], model: ModelConstants): { byCategory: Map<string, number>; global: number } {
  const live = protocols.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0);
  const global = median(live.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b));
  const clamp = (r: number): number => Math.min(model.ratio_max, Math.max(model.ratio_min, r));
  const byCategory = new Map<string, number>();
  const cats = new Map<string, number[]>();
  for (const p of live) {
    const key = p.category ?? 'Other';
    const arr = cats.get(key);
    if (arr) arr.push(p.mcap_usd! / p.tvl_usd);
    else cats.set(key, [p.mcap_usd! / p.tvl_usd]);
  }
  for (const key of [...cats.keys()].sort()) {
    const arr = cats.get(key)!.sort((a, b) => a - b);
    byCategory.set(key, arr.length >= model.ratio_min_category_n ? clamp(median(arr)) : clamp(global));
  }
  return { byCategory, global: clamp(global) };
}

/** The airdrop share for a TVL: bigger protocols, smaller slice. */
export function airdropShare(tvlUsd: number, model: ModelConstants): number {
  if (tvlUsd >= model.tier_big_usd) return model.share_tier_big;
  if (tvlUsd >= model.tier_mid_usd) return model.share_tier_mid;
  return model.share_tier_small;
}

/** Launch probability from age, size and 7-day growth, clamped to [prob_min, prob_max]. */
export function launchProbability(p: SnapshotProtocol, age: number | null, model: ModelConstants): number {
  const ageForModel = age ?? model.unknown_age_days;
  const ageTerm = Math.min(Math.max(ageForModel, 0), model.prob_age_days) / model.prob_age_days;
  const sizeTerm = Math.min(Math.max(Math.log10(Math.max(p.tvl_usd, 1) / 5_000_000), 0), model.prob_size_log_max) / model.prob_size_log_max;
  const growth = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(p.change_7d, 0)));
  const raw =
    model.prob_base +
    model.prob_age_weight * ageTerm +
    model.prob_size_weight * sizeTerm +
    model.prob_growth_weight * (growth / 100);
  return Math.min(model.prob_max, Math.max(model.prob_min, raw));
}

/** The full scoring of one protocol: FDV, share, probability, implied value. */
export function scoreProtocol(
  p: SnapshotProtocol,
  asOf: string,
  ratio: number,
  model: ModelConstants,
): { implied: number; fdv: number; share: number; prob: number; growthPct: number; age: number | null } {
  const age = ageDays(asOf, p.listed_at);
  const fdv = Math.round(p.tvl_usd * ratio);
  const share = airdropShare(p.tvl_usd, model);
  const prob = launchProbability(p, age, model);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(p.change_7d, 0)));
  const implied = Math.max(1, Math.round(fdv * share * prob));
  return { implied, fdv, share, prob, growthPct, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/**
 * Categories that are a wrapped, staked or bridged product of a token that
 * already trades, not a protocol still waiting on a launch of its own: the
 * same exclusion the watchlist rule draws, extended to the early radar.
 */
const WRAPPED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** Whole words in a name that mark a wrapped or staked product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Exchange names a wrapped product's name begins with. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not an exchange,
 * not a versioned pool, and not a wrapped, staked or bridged product of a
 * token that already trades. WBTC is Bitcoin on Ethereum and a canonical
 * bridge is a bridge, not a launch waiting to happen.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && WRAPPED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const { byCategory, global } = categoryRatios(snapshot.protocols, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // Early radar: every other rankable pre-token protocol, by TVL, capped.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const ratio = byCategory.get(p.category ?? 'Other') ?? global;
    const s = scoreProtocol(p, snapshot.as_of, ratio, model);
    return { p, ratio, ...s };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_ratio: round4(s.ratio),
      implied_fdv_usd: s.fdv,
      airdrop_share: s.share,
      launch_probability: round4(s.prob),
      growth_pct: s.growthPct,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: action, then cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page for the next step.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 500;
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 25_000_000) return 100;
  return 50;
}

/** Gas estimate for one transaction on the protocol's main chain. */
function gasFor(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 'about $6 to $12 of gas on Ethereum';
  if (c === 'solana') return 'under $0.10 of gas on Solana';
  if (c === 'bitcoin') return 'about $2 to $5 of gas on Bitcoin';
  return 'about $1 to $3 of gas on this chain';
}

/** How long to hold, from the protocol's age: younger protocols get a longer window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 90;
  if (age < 365) return 60;
  if (age < 730) return 45;
  return 30;
}

/** The category's core action, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Supply $${capital} of USDC to ${name} on ${chain}, then borrow $20 of a stable asset against it so the position shows both sides of the market.`;
  }
  if (c.includes('dex') || c.includes('liquidity manager') || c.includes('leveraged farm')) {
    return `Provide $${capital} of liquidity to ${name}'s largest pool on ${chain}, in a balanced pair, and keep the position open.`;
  }
  if (c.includes('bridge') || c.includes('cross chain')) {
    return `Bridge $${capital} of USDC into ${chain} through ${name}, then use the bridged funds inside the app it points to.`;
  }
  if (c.includes('liquid staking') || c.includes('restak') || c.includes('staking pool')) {
    return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token in the same wallet.`;
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) {
    return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged position, then close it after a day.`;
  }
  if (c.includes('prediction')) {
    return `Fund $${capital} on ${name} on ${chain} and place one position in a market that settles within the next two weeks.`;
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('onchain capital')) {
    return `Deposit $${capital} into a ${name} vault on ${chain} and hold the vault shares in the farming wallet.`;
  }
  if (c.includes('stable') || c.includes('dual-token')) {
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the farming wallet.`;
  }
  if (c.includes('rwa')) {
    return `Mint $${capital} of the yield-bearing asset ${name} issues on ${chain} and hold it for the full farming window.`;
  }
  if (c.includes('insurance')) {
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the whole farming window.`;
  }
  if (c.includes('yield aggregator') || c === 'yield' || c.includes('yield')) {
    return `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and let it compound.`;
  }
  if (c.includes('payment')) {
    return `Move $${capital} through ${name} on ${chain} for a real payment, then keep a small balance in the app.`;
  }
  if (c.includes('chain')) {
    return `Bridge $${capital} of USDC to ${chain} and use ${name}'s native app once a week while the position is open.`;
  }
  if (c.includes('governance')) {
    return `Deposit $${capital} into ${name} on ${chain}, then vote in its next on-chain proposal from the farming wallet.`;
  }
  if (c.includes('privacy')) {
    return `Deposit $${capital} into ${name}'s shielded pool on ${chain} and withdraw it only after the hold window ends.`;
  }
  if (c.includes('index') || c.includes('farm') || c.includes('option')) {
    return `Deposit $${capital} into ${name}'s main product on ${chain} and keep the position open for the full window.`;
  }
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open for the full window.`;
}

/** The category's weekly recurring action, so the wallet stays active. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'repay a small part of the borrow and re-supply it, so the wallet shows fresh lending activity.';
  if (c.includes('dex') || c.includes('liquidity manager')) return 'swap a small amount through the pool and re-add the liquidity if the range drifted.';
  if (c.includes('bridge')) return 'bridge a small amount back and forth once, keeping the main position untouched.';
  if (c.includes('staking') || c.includes('restak')) return 'claim any staking rewards and restake them in the same wallet.';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) return 'open and close one small hedged trade, keeping total exposure under the original deposit.';
  if (c.includes('prediction')) return 'place one small position in a newly listed market.';
  if (c.includes('governance')) return 'vote in any new proposal and check the forum for the next one.';
  if (c.includes('curator') || c.includes('allocator')) return 'check the vault allocation and top it up by $10 if a new strategy opened.';
  return 'make one small deposit, swap or vote so the wallet shows activity every week.';
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * Derived from the protocol's own record (category, chains, TVL, age) only.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  return [
    {
      text: `Set up a fresh wallet that holds only the funds you plan to farm with, write its seed phrase on paper, and fund it with $${capital + 20} so gas is covered.`,
      cost: `${gas} for the first transaction`,
      time: '10 minutes to set up',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital plus ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: `Once a week, ${weeklyFor(p)}`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and do not move the funds to another wallet mid-way.`,
      cost: `the $${capital} stays locked in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and check the wallet's standing; claim only from a link the protocol itself publishes.`,
      cost: 'no fee to check, and never pay anyone to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet address, the deposit dates and every transaction hash in a farm log, so you can repeat the position on the next protocol or unwind it cleanly.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's live section. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_fdv_usd: row.model.implied_fdv_usd,
    category_ratio: row.model.category_ratio,
    airdrop_share: row.model.airdrop_share,
    launch_probability: row.model.launch_probability,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const { global } = categoryRatios(snapshot.protocols, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_ratio: global,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.implied_value_usd > 100_000_000_000_000) return `${r.slug} has implied value over the cap`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
