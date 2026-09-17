# Tunnel review — `settled.twzrd.xyz`

Status: **applied 2026-09-17.** Public `https://settled.twzrd.xyz` returns 200
(`/health`, `/`, `/llms.txt`). Origin is `x402-mrr.service` on `127.0.0.1:4040`.
Ingress lives on `cloudflared-battleship.service`. Do not re-apply.

Default `~/.cloudflared/cert.pem` authenticates the **outbid.sh** account. DNS
for this hostname must use `TUNNEL_ORIGIN_CERT=~/.cloudflared/cert-twzrd-xyz.pem`.
A first attempt with the default cert created `settled.twzrd.xyz.outbid.sh`;
that CNAME was deleted (outbid zone API, HTTP 200).

Proposed public hostname: **`settled.twzrd.xyz`**
- DNS today: no A/AAAA/CNAME (checked 2026-09-17). Name is free on the zone.
- Not `mrr.twzrd.xyz` — public copy is observed settled volume, not MRR.
- Not `outbid.sh` — different tunnel (`outbid-sh`), different product.

Target origin: `http://127.0.0.1:4040` on battleship, same pattern as
`intel.twzrd.xyz` → `127.0.0.1:8001`. Host bind stays loopback; the tunnel
connector is what publishes.

Live unit: `cloudflared-battleship.service` (user scope). That connector already
serves `api.twzrd.xyz`, `intel.twzrd.xyz`, and `twzrd.xyz`. Editing its
`config.yml` and restarting it blips those hostnames. Outbid (`:4024`) is a
**different** connector and is not in this change.

## What is already true

- Snippet: `ops/cloudflared-ingress.snippet.yml`
- Diff: `ops/config.yml.ingress.diff`
- Live config currently sends `https://settled.twzrd.xyz/` to the catch-all 404
  (`cloudflared tunnel --config ~/.cloudflared/config.yml ingress rule`).
- A temp copy with the snippet inserted validated OK; intel/api rules still
  matched. That temp file was deleted. Live `config.yml` was not written.

## Apply order (when named)

Do these in order. Skipping 1 and publishing DNS+ingress 502s/1016s the new
name and still costs a tunnel restart.

1. **Origin up on loopback**
   ```bash
   ss -lntH | awk '$4 ~ /4040/'          # expect 127.0.0.1:4040
   curl -sf http://127.0.0.1:4040/health
   ```
   If nothing is listening, start the staged unit (still not public):
   ```bash
   mkdir -p ~/.config/systemd/user
   cp /home/twzrd/x402-mrr/ops/x402-mrr.service ~/.config/systemd/user/
   systemctl --user daemon-reload
   systemctl --user enable --now x402-mrr.service
   ```
   `:4040` was stopped on 2026-09-17; do not assume it is up.

2. **DNS CNAME** (independent of the process; creates the name, does not proxy
   until the tunnel is running *and* the ingress row exists):
   ```bash
   # NAME = the tunnel already serving intel.twzrd.xyz
   # (cloudflared tunnel list — do not paste UUID into tickets)
   TUNNEL_ORIGIN_CERT=~/.cloudflared/cert-twzrd-xyz.pem \
     cloudflared tunnel route dns <NAME> settled.twzrd.xyz
   ```
   Equivalent dashboard: zone `twzrd.xyz`, CNAME `settled` →
   `<tunnel-uuid>.cfargotunnel.com`, proxied.
   Docs: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/

3. **Ingress row, then restart the battleship connector**
   ```bash
   cp -a ~/.cloudflared/config.yml ~/.cloudflared/config.yml.bak.$(date -u +%Y%m%dT%H%M%SZ)
   # insert ops/cloudflared-ingress.snippet.yml before the catch-all
   cloudflared tunnel --config ~/.cloudflared/config.yml ingress validate
   cloudflared tunnel --config ~/.cloudflared/config.yml ingress rule https://settled.twzrd.xyz/health
   # expect: hostname settled.twzrd.xyz / http://127.0.0.1:4040
   systemctl --user restart cloudflared-battleship.service
   ```
   Restart is the blast radius: `api.twzrd.xyz`, `intel.twzrd.xyz`, `twzrd.xyz`
   drop until the connector re-registers (seconds, not minutes, but it is live
   prod). Do not combine with an intel image swap.

4. **Prove**
   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' https://settled.twzrd.xyz/health
   curl -sS https://settled.twzrd.xyz/llms.txt | head
   ```
   Expect 200 and the "not MRR" honesty block.

## Rollback

```bash
# restore the backup written in step 3, then:
systemctl --user restart cloudflared-battleship.service
```
DNS can stay; a missing ingress row 404s the new name only. Deleting the CNAME
is optional cleanup.

## Explicitly not this change

- Do not bind the origin to `0.0.0.0`.
- Do not put Settled on the `outbid-sh` tunnel or on `:4024`.
- Do not create a Doppler project (still no secrets).
- Do not edit `~/.cloudflared/*.json` credential files.
- Do not `cloudflared tunnel route dns` or restart the unit from this checklist
  without a new operator go.
