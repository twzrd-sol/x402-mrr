# Agent notes

This tree is a **read-only integrator** of `https://intel.twzrd.xyz`.

- Do not import wash, receipts, or scoring from `wzrd-final`.
- Do not touch `/home/twzrd/outbid`, `:4024`, or `cloudflared-battleship`.
- Do not bind the host to `0.0.0.0`. Docker may listen on container `0.0.0.0` only if the publish is `127.0.0.1:4040:4040`.
- `https://settled.twzrd.xyz` is live (applied 2026-09-17). Origin unit `x402-mrr.service` binds `127.0.0.1:4040`. Do not restart `cloudflared-battleship` or re-run `tunnel route dns` without a new go. Default `cert.pem` is outbid.sh; twzrd.xyz DNS uses `cert-twzrd-xyz.pem`.
- Doppler: project `x402-mrr`, config `prd`. Do not copy secrets from `outbid` or `twzrd-aggregator`. Do not put wallet keys here. V1 does not `doppler run` the origin unit.
- Public copy: observed settled volume, never MRR. `wash_flagged=null` is unevaluated, not clean.
- Overnight slices: `ops/OVERNIGHT.md`. SHIP items without a per-slice founder stop. HOLD items (origin / `cloudflared-battleship` restart, host `0.0.0.0`, fold into `wzrd-final` / outbid, not-MRR stamp) stay held.
- Tests use recorded fixtures under `test/fixtures/`. Ranking logic must stay fixture-backed; do not stub wash outcomes.
- Git author: `TWZRD` / `33047129+twzrd-sol@users.noreply.github.com`. Branch namespace `grok/` if this session opens a PR.
