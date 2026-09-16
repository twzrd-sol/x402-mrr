import type { Lane, RankedSeller, SellerRow, WashFlag } from "./types.ts";

export function normalizeWash(value: unknown): WashFlag {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

export function laneOf(wash: WashFlag): Lane {
  if (wash === true) return "flagged";
  if (wash === false) return "ranked";
  return "unevaluated";
}

function compareVolume(a: SellerRow, b: SellerRow): number {
  const rev = b.total_revenue_usd_90d - a.total_revenue_usd_90d;
  if (rev !== 0) return rev;
  const payers = b.unique_payers_90d - a.unique_payers_90d;
  if (payers !== 0) return payers;
  return a.merchant.localeCompare(b.merchant);
}

export function sortLane(rows: readonly SellerRow[]): SellerRow[] {
  return [...rows].sort(compareVolume);
}

export function growthPct(current: number, previous: number | null): number | null {
  if (previous === null || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function assignRanks(
  rows: readonly SellerRow[],
  previousVolume: ReadonlyMap<string, number> = new Map(),
): RankedSeller[] {
  const buckets: Record<Lane, SellerRow[]> = {
    ranked: [],
    unevaluated: [],
    flagged: [],
  };
  for (const row of rows) {
    buckets[laneOf(row.wash_flagged)].push(row);
  }
  const out: RankedSeller[] = [];
  for (const lane of ["ranked", "unevaluated", "flagged"] as const) {
    const sorted = sortLane(buckets[lane]);
    sorted.forEach((row, i) => {
      out.push({
        ...row,
        lane,
        rank_in_lane: i + 1,
        growth_pct: growthPct(
          row.total_revenue_usd_90d,
          previousVolume.has(row.merchant) ? previousVolume.get(row.merchant)! : null,
        ),
      });
    });
  }
  return out;
}

export function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

export function volumeOf(rows: readonly SellerRow[]): number {
  return roundUsd(rows.reduce((sum, row) => sum + row.total_revenue_usd_90d, 0));
}

export function parseSeller(raw: unknown): SellerRow | null {
  if (raw === null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.merchant !== "string" || o.merchant.length < 32) return null;
  const revenue = Number(o.total_revenue_usd_90d);
  const payers = Number(o.unique_payers_90d);
  const txs = Number(o.total_tx_90d);
  if (!Number.isFinite(revenue) || !Number.isFinite(payers) || !Number.isFinite(txs)) {
    return null;
  }
  const numOrNull = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const strOrNull = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;
  return {
    merchant: o.merchant,
    scoreable: o.scoreable !== false,
    unique_payers_90d: payers,
    total_tx_90d: txs,
    total_revenue_usd_90d: revenue,
    repeat_payer_pct: numOrNull(o.repeat_payer_pct),
    captive_payer_pct: numOrNull(o.captive_payer_pct),
    heavy_fleet_revenue_pct: numOrNull(o.heavy_fleet_revenue_pct),
    days_since_last_settle: numOrNull(o.days_since_last_settle),
    gone_dark: o.gone_dark === true,
    wash_label: strOrNull(o.wash_label),
    wash_flagged: normalizeWash(o.wash_flagged),
    wash_confidence: strOrNull(o.wash_confidence),
    provider_reputation_tier: strOrNull(o.provider_reputation_tier),
    demand_shape: strOrNull(o.demand_shape),
    organic_breadth_claim: typeof o.organic_breadth_claim === "boolean" ? o.organic_breadth_claim : null,
  };
}
