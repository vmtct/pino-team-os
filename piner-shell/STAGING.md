# PAP-1952 · PNR-APP-HUB — Piner staging hostname (14/11/2026)

## Environments

| Environment | Hostname | Cloudflare Worker | Route mechanism |
| --- | --- | --- | --- |
| Staging | https://app.staging.pinohouse.art | `piner-app-shell-staging` | Worker Custom Domain |
| Live FE Shell | https://app.pinohouse.art | `piner-app-shell-pap1943` | Worker Route `app.pinohouse.art/*` |
| Local authoritative prototype | http://192.168.1.6:8800/piner | i5 prototype keeper | NO release changes |

Staging and live have distinct deployed Workers, script deployments and hostnames. `piner-shell/wrangler.staging.jsonc` deploys **only** `piner-app-shell-staging` with `src/staging-worker.mjs`. Do not deploy staging with `piner-shell/wrangler.jsonc`: that is the independently deployed FE-only Worker currently attached to LIVE.

## Cloudflare authority (readback confirmed)

- Account: `952c3c8a236f8e4cbcf6ee10b86ad70c`
- Zone: `48b2809afabf3d65d30f80f346126213`
- Staging Worker Custom Domain ID: `3f6cdd67fcfadfcc3efd8889e554a8f28f29b14f`
- Staging certificate: `f3d5c6e4-2aa2-4916-bb0b-b563fcf5fa62`
- Cloudflare-managed staging DNS: proxied `AAAA 100::` for `app.staging.pinohouse.art`.
- Existing live Worker Route ID: `e9484a7cc88146ef9934b36d2ba34ce5` — **DO NOT MODIFY**.
- Existing live R2 public Custom Domain `app.pinohouse.art` and its Cloudflare-managed `CNAME public.r2.dev` — **DO NOT MODIFY**.
- Both Workers use the existing `app-piner` R2 bucket binding for public brand asset reads only. No R2 writes, list or private media are available.

## Deploy staging only

1. On i5, verify the exact source SHA and clean independent worktree; ensure PAP-1952 is assigned. Do not edit `PINER-SPACE/source` or use i3.
2. `node --test piner-shell/test/shell.test.mjs piner-shell/test/staging.test.mjs`.
3. `wrangler deploy --dry-run --config piner-shell/wrangler.staging.jsonc` and CI of the exact feature-branch commit.
4. `wrangler deploy --config piner-shell/wrangler.staging.jsonc` to update **staging Worker only**. This config does NOT create/change custom domains.
5. Playwright on actual `https://app.staging.pinohouse.art`: six widths 320/390/768/1024/1440/1920 × launcher/Afterschool/MyTime; header/footer scroll, switcher, all 4 tabs, 4/4 R2 PNG SHA256 parity vs saved `pap1945-preflight-baseline.json`, no private user data; `/piner/public` and `/api/piner/context` 404, POST 405; zero console errors or unauthorized writes.
6. Confirm production `https://app.pinohouse.art` remains unchanged and Worker Route still targets `piner-app-shell-pap1943`.

**Cloudflare auto-injection guard:** Worker Custom Domain caused Cloudflare Web Analytics beacon to be added to HTML, triggering a CSP console error under `script-src 'self'`. The staging-only wrapper sets `Cache-Control: no-store, no-transform` **on HTML only**, preventing Cloudflare content mutation while keeping no-store and strict CSP. R2 branding images retain their existing cache metadata and public read behavior; do not weaken CSP or grant third-party scripts.

## Rollback

If staging breaks, first rollback only the **staging Worker** to its last known working version; do not touch live Worker. If the staging hostname must be detached, verify matching Worker Domain ID and service, then delete **only** Worker Custom Domain `3f6cdd67fcfadfcc3efd8889e554a8f28f29b14f` at Cloudflare `/accounts/{account_id}/workers/domains/{domain_id}`; verify the staging DNS is cleaned up. **Never delete or modify** the live Worker Route ID, R2 domain, public asset CNAME, other Workers or private Core bindings.

## Gate / limits

Staging contains only **FE Shell** with fail-closed unauthenticated adapter (no real member session, child list, Center, private Posts, uploads, Community, sharing, social or notifications). Identity and authenticated G4 require their separate epic. PR-level shared PAP-1895 datetime validation must remain required; do not bypass it or treat this staging deployment as permission to merge the Draft PR. PINO design parity follows canonical i5 prototype. Reviewer: `N/A_BY_SOLO_FOUNDER`.
