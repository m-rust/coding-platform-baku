# Deploying Baku for free

Three pieces, three hosts:

| Piece | Host | Cost |
|-------|------|------|
| Frontend (Vite build) | Vercel | free |
| Postgres | Neon | free |
| API + Docker judge | Oracle Cloud Always Free VM | free |

The frontend proxies `/api/*` to the VM, so the browser only ever talks to one
origin. That keeps the refresh cookie same-site and removes CORS entirely — no
change to the cookie settings is needed.

```
browser ──► yourapp.vercel.app ──rewrite──► api.duckdns.org ──► Caddy ──► node :5000
                                                                            │
                                                                       docker run
```

---

## 1. Database — Neon

1. Create a project at neon.tech and copy the connection string.
2. It already ends in `?sslmode=require`; keep that.

Free tier auto-suspends after ~5 minutes idle, so the first query after a lull
takes about a second.

---

## 2. VM — Oracle Cloud Always Free

> **If Oracle signup fails** (common — card verification), use Google Cloud's
> always-free `e2-micro` instead. Same files, same steps; see *Alternative
> hosts* at the end for the three settings that differ.

Create an **Ampere (ARM) VM.Standard.A1.Flex** instance, Ubuntu 22.04, 2 OCPU /
12 GB is plenty. ARM capacity is often unavailable in busy regions — retry, or
pick another availability domain.

In the instance's **subnet security list**, allow ingress on TCP **80** and
**443** from `0.0.0.0/0`. Then on the box:

```bash
# Ubuntu also firewalls locally, and this is the step people miss
sudo iptables -I INPUT -p tcp --dport 80  -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### Install Docker and Node

```bash
curl -fsSL https://get.docker.com | sudo sh
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

### Create the service user

The judge shells out to the `docker` CLI, so this user needs docker access.
Membership of the `docker` group is root-equivalent on the host — acceptable
here because the API *is* the judge, but worth knowing.

```bash
sudo useradd -m -s /bin/bash baku
sudo usermod -aG docker baku
sudo mkdir -p /opt/baku && sudo chown baku:baku /opt/baku
```

---

## 3. Hostname — DuckDNS

Let's Encrypt needs a name, not an IP. Register a free subdomain at duckdns.org
and point it at the VM's public IP.

---

## 4. Deploy the API

```bash
sudo -iu baku
git clone <your-repo> /opt/baku
cd /opt/baku/backend
npm ci --omit=dev

# build the three sandbox images (on ARM they build from arm64 base images)
npm run sandbox:build
```

Write `/opt/baku/backend/.env`:

```bash
DATABASE_URL="postgresql://...neon.tech/db?sslmode=require"
ACCESS_JWT_SECRET="<32 random bytes>"
REFRESH_JWT_SECRET="<32 different random bytes>"
NODE_ENV=production
PORT=5000
TRUST_PROXY_HOPS=2
JUDGE_CONCURRENCY=2
JUDGE_MAX_WAITING=8
GEMINI_API_KEY=""
```

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then apply the schema and start it:

```bash
npx prisma migrate deploy
npx prisma generate
exit   # back to your sudo user

sudo cp /opt/baku/deploy/baku-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now baku-api
journalctl -u baku-api -f
```

You should see `server is running at port number 5000`.

---

## 5. TLS — Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# edit the hostname first
sudo cp /opt/baku/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Verify from your laptop:

```bash
curl https://YOUR-NAME.duckdns.org/api/languages
```

---

## 6. Frontend — Vercel

Edit `frontend/vercel.json` and replace `REPLACE-ME.duckdns.org` with your
hostname. Then import the repo on Vercel with:

- **Root directory:** `frontend`
- **Environment variable:** `VITE_API_URL` = `/api`

`/api` is relative on purpose. Requests go to your Vercel domain, get rewritten
to the VM server-side, and the browser therefore treats the refresh cookie as
first-party.

---

## Why `TRUST_PROXY_HOPS=2`

`express-rate-limit` buckets by client IP. Behind Vercel and Caddy, `req.ip`
would be the proxy's address for every visitor — so one person hitting the
login limit would lock out everyone. Two hops (Vercel, then Caddy) makes Express
read the real client address from `X-Forwarded-For`.

Confirm it after deploying: 21 rapid failed logins from one machine should
return `429`, and a different machine should still be able to log in.

---

## Checks after going live

```bash
# judge works end to end
journalctl -u baku-api -f          # watch while you submit from the UI

# nothing leaked
docker ps -a --filter name=judge-  # should be empty between runs

# refresh survives the access token expiring
# log in, wait 90s, click around — you should not be logged out
```

If you *are* logged out after a minute, the proxy rewrite is not in effect and
the cookie is being treated as cross-site. Check that the frontend is calling
`/api/...` and not the VM hostname directly.

---

## Alternative hosts

### Google Cloud always-free `e2-micro`

Free forever, full root, Docker works. Must be in `us-west1`, `us-central1` or
`us-east1`. Three differences from the Oracle instructions:

```bash
# 1. 1GB RAM needs swap, or C++ compiles get OOM-killed
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

```bash
# 2. in .env — smaller ceilings and a single judge slot
JUDGE_CONCURRENCY=1
JUDGE_COMPILE_MEMORY=320m
JUDGE_RUN_MEMORY=192m
```

3. Firewall rules are set in the VPC console (allow tcp:80,443), not iptables.

`os.cpus()` reports the host's cores rather than your share, so leaving
`JUDGE_CONCURRENCY` unset would let the queue admit far more work than the box
can run. Set it explicitly.

### AWS or Azure

Both give a 1GB VM free for 12 months (`t3.micro` / `B1s`) — not permanent, but
long enough for a portfolio deployment. Use the same settings as the GCP box.

### A machine you already own — no cloud account needed

If cloud signups keep failing, run the API and judge on your own machine and
expose it through a tunnel. Vercel and Neon both accept GitHub sign-in without a
card, so this needs no payment method anywhere.

The tunnel must give a **stable** hostname — the Vercel rewrite points at a
fixed URL, so anything that hands out a fresh random address on restart will
break every time you restart.

**Tailscale Funnel** — free for personal use, no card, no domain required, and
the hostname is stable:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
sudo tailscale funnel 5000          # serves localhost:5000 publicly over HTTPS
tailscale funnel status             # prints your https://<machine>.<tailnet>.ts.net URL
```

**ngrok** — the free plan includes one static domain; claim it in the dashboard:

```bash
ngrok http 5000 --url your-name.ngrok-free.app
```

**Cloudflare Tunnel** — best of the three, but a named tunnel requires a domain
already added to Cloudflare (~$10/yr). Worth it if you own one:

```bash
cloudflared tunnel login
cloudflared tunnel create baku
cloudflared tunnel route dns baku api.yourdomain.com
cloudflared tunnel run --url http://localhost:5000 baku
```

Whichever you pick: put that hostname in `frontend/vercel.json`, skip Caddy and
DuckDNS entirely (the tunnel terminates TLS), and set `TRUST_PROXY_HOPS=2` —
Vercel, then the tunnel.

Free-tier terms for these change often; check the current limits before
committing to one.

The real trade is uptime: the site works only while that machine is running and
the tunnel is up. Fine for a demo you can switch on, weak for a link on a CV.
Run the tunnel as a service so it survives reboots.

## Notes

- `sandbox:build` must be run **on the VM**. Missing images make every
  submission return `internal_error`.
- Set `JUDGE_CONCURRENCY` to roughly the core count minus one. Each judge
  container is pinned to one CPU.
- Judging state is in-process. Redeploying mid-run strands submissions as
  `pending`; the startup sweep marks them `internal_error` on the next boot.
- Oracle reclaims idle Always Free resources. Keep the box doing something, or
  expect to rebuild it occasionally.
