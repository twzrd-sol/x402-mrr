# Deploy (staged, not live)

Public hostname and Cloudflare Tunnel ingress are **held**. This process binds loopback on the host.

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

`ops/x402-mrr.service` is staged. Do **not** `systemctl --user enable --now` it until the operator names that step. Installing the unit file:

```bash
mkdir -p ~/.config/systemd/user
cp ops/x402-mrr.service ~/.config/systemd/user/
systemctl --user daemon-reload
# enable only when told
```

## Tunnel / DNS

**Staged, not applied.** Review artifact:

- Hostname: `settled.twzrd.xyz` (no DNS today)
- Snippet: `ops/cloudflared-ingress.snippet.yml`
- Diff: `ops/config.yml.ingress.diff`
- Apply/rollback checklist: `ops/TUNNEL-REVIEW.md`

Adding a hostname to `cloudflared-battleship.service` is a live-prod change
(api + intel + frontend share that connector). Do not apply the snippet,
`cloudflared tunnel route dns`, or restart the unit without an explicit go.

## Doppler

V1 is read-only against public intel HTTP. No wallet keys. Do not create an `x402-mrr` Doppler project until a secret actually exists.
