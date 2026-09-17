import type { Board } from "./types.ts";

function usd(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function renderLlmsTxt(board: Board): string {
  const s = board.stats;
  const src = board.source;
  return `# Settled — x402 observed volume, not MRR

> ${board.honesty.product}

> ${board.honesty.not_this_product}

> Metric: ${board.honesty.metric}
> Window: ${board.honesty.window}
> Wash: ${board.honesty.wash}

## Snapshot

- source: ${src.intel_base}${src.sellers_path}
- window: ${src.window}
- fetched_at: ${src.fetched_at ?? "none"}
- score_version: ${src.score_version ?? "unknown"}
- truncated: ${src.truncated}

## Lane counts

| lane | wallets | observed USD (90d) |
|---|---:|---:|
| ranked (wash_flagged=false) | ${s.ranked} | ${usd(s.ranked_volume_usd_90d)} |
| unevaluated (wash_flagged=null) | ${s.unevaluated} | ${usd(s.unevaluated_volume_usd_90d)} |
| flagged (wash_flagged=true) | ${s.flagged} | ${usd(s.flagged_volume_usd_90d)} |
| all | ${s.sellers} | ${usd(s.ranked_volume_usd_90d + s.unevaluated_volume_usd_90d + s.flagged_volume_usd_90d)} |

Wash overlay: ${s.overlay_full} full (two-sided), ${s.overlay_partial} inbound-only. Ranked requires full overlay and wash_flagged=false.
Intel ranks this inventory by unique payers with wash orthogonal. On this snapshot the unique-payer leader sits in the ${s.payers_leader_lane ?? "unknown"} lane. Settled never puts wash_flagged=true in the ranked lane.

null is not clean and not a discount. true never enters the ranked lane. This board does not recompute wash.
90 days is a sliding scoring window; older settles remain in intel's event table.

## HTTP

- GET /api/leaderboard?limit=50
- GET /api/seller/{wallet}
- GET /health
- POST /mcp  (tools: leaderboard, seller)
- GET /llms.txt  (this file)

Do not pay anyone because they appear here. Ranked means TWZRD's public card did not flag them — not an identity claim, not delivery proof, not a buy recommendation.
`;
}
