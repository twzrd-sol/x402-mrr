# Agent notes

This tree is a **read-only integrator** of `https://intel.twzrd.xyz`.

- Do not import wash, receipts, or scoring from `wzrd-final`.
- Do not touch `/home/twzrd/outbid`, `:4024`, or `cloudflared-battleship`.
- Do not bind the host to `0.0.0.0`. Docker may listen on container `0.0.0.0` only if the publish is `127.0.0.1:4040:4040`.
- Do not enable `ops/x402-mrr.service` or add tunnel ingress without an explicit operator go.
- Public copy: observed settled volume, never MRR. `wash_flagged=null` is unevaluated, not clean.
- Tests use recorded fixtures under `test/fixtures/`. Ranking logic must stay fixture-backed; do not stub wash outcomes.
- Git author: `TWZRD` / `33047129+twzrd-sol@users.noreply.github.com`. Branch namespace `grok/` if this session opens a PR.
