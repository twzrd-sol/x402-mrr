import type { HonestyCopy } from "./types.ts";

export const INTEL_SELLERS_PATH = "/v1/intel/sellers";
export const WINDOW = "90 days";

export const HONESTY: HonestyCopy = {
  product:
    "A public leaderboard of x402 receive wallets, ranked by observed settled USD in TWZRD's 90-day Solana corpus, after wash_flagged=true is removed from the ranked lane.",
  not_this_product:
    "This is not MRR, not a SaaS-acquisition marketplace, not proof of delivery, not a complete x402 catalog, and not a re-score of wash. Escrow and listing-for-sale are out of V1.",
  metric:
    "total_revenue_usd_90d from GET /v1/intel/sellers (observed settlement, not seller-reported). Micropayments are not recurring revenue — do not call this MRR.",
  window:
    "90 days is intel's public scoring window (GET /v1/intel/sellers), not the size of the corpus. Older settles remain in intel's event table; they slide off this board. There is no 30-day public series on this integrator path.",
  wash:
    "wash_flagged is tri-state. true = flagged, excluded from ranked. false = evaluated and not flagged, the only ranked lane. null = never evaluated (missing wash overlay), shown greyed, never treated as clean and not a discount.",
};

export const USER_AGENT =
  "x402-mrr/0.1 (read-only integrator of https://intel.twzrd.xyz/v1/intel/sellers)";
