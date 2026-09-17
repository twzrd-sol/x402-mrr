# Overnight slice queue

Operator 2026-09-17: keep pushing small production-hardening slices on
Settled without a per-slice founder stop. This file is the queue. Next
session reads it instead of re-planning.

Public copy is observed settled volume, **never MRR**.

## Standing holds (do not lift here)

- Do not restart `x402-mrr.service` (origin) or `cloudflared-battleship`.
- Do not bind the host to `0.0.0.0`.
- Do not fold this tree into `wzrd-final` or outbid. Do not touch `:4024`.
- Do not remove the not-MRR stamp. Do not invent a 365-day public sellers window.
- Do not `doppler run` the origin unit. Do not add a second hostname.

Queued **SHIP** slices go without founder approval. **HOLD** slices wait
for a named go (usually an origin boot). “With me involved” means the
operator can still name a hold; it is not a stop on every SHIP slice.

Prefer work that goes live from `public/` (HTML is read per request; JS
needs `app.js?v=` cache-bust). Anything that only applies after `dist/`
reload stays HOLD.

## Done

- #1 docs match 2026-09-17 apply
- #2 90d scoring window / unevaluated ≠ undervalued
- #3 overlay column + createApp `Cache-Control: no-store` (headers HOLD until origin boot)
- #4 unique-payer rank is orthogonal; flagged can lead
- #5 hash-address lanes; overlay on small screens
- #6 agent feeds; receive wallets ≠ payer board (`6aa802b`)
- `GET /robots.txt` → `/llms.txt` and `/api/leaderboard` (this branch)

## Remaining (ordered)

1. **SHIP** — JSON-LD `ItemList` on the board for the visible lane
   (`public/app.js`, cache-bust). Receive wallets only; not MRR.
2. **SHIP** — `rel=canonical` on `index.html` plus Open Graph copy that
   says receive-wallet board, not `twzrd.xyz/leaderboard`.
3. **HOLD** — origin boot of `x402-mrr.service` so createApp `no-store`,
   folio `overlay_full` / `payers_leader_lane`, and `/llms.txt` body go
   live. Do not restart `cloudflared-battleship`.
4. **HOLD** — MCP `leaderboard` tool description: receive vs payer vs
   attention markets (needs `dist/` reload).
