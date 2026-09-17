# Settled (`x402-mrr`)

Public leaderboard of **observed x402 settled volume**, ranked only after `wash_flagged=true` is removed from the ranked lane.

This is **not MRR**. x402 is per-call micropayments. Calling it recurring revenue would be a credibility bug on day one.

Standalone sibling of `wzrd-final` and `outbid`. It consumes TWZRD the way any third-party integrator would: public HTTP only. No intel DB, no outbid token, no Cloudflare Tunnel until the operator names that change.

## Why this exists

TrustMRR's trick is "don't trust self-reported revenue." TWZRD already has the stronger primitive for x402: settlement-graph receipts plus wash flags.

Intel's own `GET /v1/intel/sellers` ranks by unique payers and **leaves wash orthogonal**. On 2026-09-16 the live corpus was:

| lane | wallets | observed USD (90d) |
|---|---:|---:|
| `wash_flagged=false` (ranked here) | 133 | $12,961 |
| `wash_flagged=null` (unevaluated, not clean) | 3,187 | $419,121 |
| `wash_flagged=true` (flagged) | 1,711 | $366,061 |
| all scoreable merchants | 5,031 | — |

Most of the dollars sit in unevaluated or flagged lanes. This site makes that the headline instead of hiding it.

## What V1 ships

- Hourly pull of `GET https://intel.twzrd.xyz/v1/intel/sellers` (page size 200, intel's cap)
- SQLite snapshot at `data/settled.sqlite`
- Three lanes: **confirmed** (`false`) / **unevaluated** (`null`) / **flagged** (`true`)
- `GET /` newsprint board, `GET /api/leaderboard`, `GET /api/seller/:wallet`, `GET /llms.txt`, `POST /mcp`
- Growth % vs the previous snapshot (null until the second refresh)

V1 does **not** ship escrow, listing-a-revenue-stream-for-sale, Stripe, or any rewrite of wash.

## Run on this machine

```bash
cd /home/twzrd/x402-mrr
npm test
npm start          # http://127.0.0.1:4040
```

Binds `127.0.0.1:4040` by default. `:4024` is outbid; do not collide. Host `0.0.0.0` is forbidden (tailnet bypasses ufw).

## Deploy

Public: `https://settled.twzrd.xyz` (applied 2026-09-17, loopback origin
`127.0.0.1:4040`). Deploy notes and rollback: `ops/README.md`.

## Honesty rules (do not regress)

- `wash_flagged=null` is never "clean"
- `wash_flagged=true` never enters the ranked lane
- Metric name in public copy: **observed settled USD (90d)**, never MRR
- Window is 90 days because that is what intel publishes
- Do not recompute wash; copy intel's tri-state
- Do not join intel's private DB
- Do not re-wire `outbid.sh` or `wzrd-final` to serve this
