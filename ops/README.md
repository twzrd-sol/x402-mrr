# Deploy (applied 2026-09-17)

Public hostname `https://settled.twzrd.xyz` is live. Origin unit
`x402-mrr.service` binds loopback `127.0.0.1:4040`. Ingress is on
`cloudflared-battleship`. Do not restart either unit without a new go.
Public copy is observed settled volume, not MRR.

## Local process

```bash
cd /home/twzrd/x402-mrr
npm test
npm start          # http://127.0.0.1:4040
```

`BIND` defaults to `127.0.0.1`. Do not set it to `0.0.0.0` on the host — the tailnet sees host `0.0.0.0` listeners regardless of ufw.

## Docker (host publish stays loopback)

Inside the container the app listens on `0.0.0.0:4040` (container namespace). Docker must publish only to host loopback:

```bash
docker build -t x402-mrr:local /home/twzrd/x402-mrr
docker run --rm --name x402-mrr \
  -p 127.0.0.1:4040:4040 \
  -e BIND=0.0.0.0 \
  -v /home/twzrd/x402-mrr/data:/app/data \
  x402-mrr:local
```

Never `-p 0.0.0.0:4040:4040` and never `-p 4040:4040`.

## systemd user unit

`ops/x402-mrr.service` is the live origin (user scope, enabled, bind
`127.0.0.1:4040`). Do not `systemctl --user restart` it without a new go.
The unit file in git is the source; copy only if the installed unit drifted:

```bash
mkdir -p ~/.config/systemd/user
cp ops/x402-mrr.service ~/.config/systemd/user/
systemctl --user daemon-reload
# do not restart or re-enable from this page
```

## Tunnel / DNS

**Applied 2026-09-17:** `https://settled.twzrd.xyz` → `127.0.0.1:4040` via
`cloudflared-battleship`. Review artifacts are the rollback map, not a “still
unapplied” checklist:

- Hostname: `settled.twzrd.xyz` (live)
- Snippet: `ops/cloudflared-ingress.snippet.yml`
- Diff: `ops/config.yml.ingress.diff`
- Apply/rollback checklist: `ops/TUNNEL-REVIEW.md`

Do not add a second hostname or restart `cloudflared-battleship` without a new
go. Rollback is in `ops/TUNNEL-REVIEW.md`. Default `cert.pem` is the outbid.sh
login — twzrd.xyz DNS needs `cert-twzrd-xyz.pem`.

## Doppler

Project **`x402-mrr`**, config **`prd`** (created 2026-09-17; empty plumbing, no
wallet keys). V1 does not inject secrets at runtime — the leaderboard still
reads public intel HTTP. `doppler run -p x402-mrr -c prd` is for later
(Cloudflare API token or a rate-limit key), not for `x402-mrr.service`.

Do not copy secrets from `outbid` or `twzrd-aggregator`.

```bash
doppler configs -p x402-mrr          # expect prd
doppler run -p x402-mrr -c prd -- <cmd>
```
