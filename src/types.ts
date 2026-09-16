export type WashFlag = true | false | null;
export type Lane = "ranked" | "unevaluated" | "flagged";

export interface SellerRow {
  merchant: string;
  scoreable: boolean;
  unique_payers_90d: number;
  total_tx_90d: number;
  total_revenue_usd_90d: number;
  repeat_payer_pct: number | null;
  captive_payer_pct: number | null;
  heavy_fleet_revenue_pct: number | null;
  days_since_last_settle: number | null;
  gone_dark: boolean;
  wash_label: string | null;
  wash_flagged: WashFlag;
  wash_confidence: string | null;
  provider_reputation_tier: string | null;
  demand_shape: string | null;
  organic_breadth_claim: boolean | null;
}

export interface RankedSeller extends SellerRow {
  lane: Lane;
  rank_in_lane: number;
  growth_pct: number | null;
}

export interface LaneBoard {
  lane: Lane;
  count: number;
  volume_usd_90d: number;
  rows: RankedSeller[];
}

export interface Board {
  honesty: HonestyCopy;
  source: {
    intel_base: string;
    sellers_path: string;
    window: string;
    score_version: string | null;
    fetched_at: string | null;
    truncated: boolean;
  };
  stats: {
    sellers: number;
    ranked: number;
    unevaluated: number;
    flagged: number;
    ranked_volume_usd_90d: number;
    unevaluated_volume_usd_90d: number;
    flagged_volume_usd_90d: number;
    gone_dark: number;
  };
  ranked: LaneBoard;
  unevaluated: LaneBoard;
  flagged: LaneBoard;
}

export interface HonestyCopy {
  product: string;
  not_this_product: string;
  metric: string;
  window: string;
  wash: string;
}
