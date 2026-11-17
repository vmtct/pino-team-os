# PAP-1943 — PINER-APP-HUB FE Shell (F1/F2)

Current Founder-approved destination: `https://app.pinohouse.art`. **Domain route NOT claimed/deployed by this preview.** The hostname is an existing Cloudflare R2 custom domain for bucket `app-piner` (read-only CNAME `public.r2.dev`), so production routing requires an explicit guarded cutover and proof of same-path R2 image compatibility.

## Scope / authority

One Piner platform; two member experiences: PINO Afterschool and MyTime by PINO. Based on authoritative i5 Piner prototype (PAP-1828 through PAP-1910), without mutating the prototype keeper or existing component branches. `/piner` (launcher), `/piner/house`, `/piner/mytime` and tabs keep canonical internal paths. Root `/` is launcher for the future app hostname.

F1: mobile max 430px, canonical PINO sigil + R2 Piner APP logo, both R2 background cards, left header/right switch, four tabs, scroll down hide/up reveal. F2: `src/adapter.mjs` owns the typed domain-neutral adapter boundary and **fails closed** with `unauthenticated` and empty content; no synthetic student/parent/Center/post/notification truth shown to public. Auth, member API, private media upload, social/public sharing and production are excluded under PAP-1829 S0-A.

Worker `src/worker.mjs` intentionally only responds to GET/HEAD: static shell, stylesheet, script and R2 `get` fallback for existing publicly accessible branding objects. Request POST/PUT/PATCH/DELETE yields 405; `/piner/public/*`, API and private routes yield 404 if no public R2 object. No user identity cookies, login endpoint, session token, new R2 objects, writes or public post publishing. Strict CSP, noindex and no-store on HTML; asset reads get original object HTTP metadata.

## Rollout guard

1. Isolated Git worktree branch `feat/pap1943-piner-shell-runtime`, only `piner-shell/*` files; CI/test/Playwright.
2. Deploy **new staging preview Worker** `piner-app-shell-pap1943` with workers.dev enabled. Do NOT add `routes` / `custom_domain` to config or alter existing R2 DNS/domain.
3. E2E on preview: 320/390/768/1024/1440/1920; launcher, member tab navigation, header/footer direction, profile panel, R2 4/4 background and logo same-path, 0 POST, negative /piner/public, no real fixture data.
4. Only with separate Founder **production route cutover approval**, proof preview R2 read exactly matches current object paths/headers, backup DNS/route and rollback guard, attach Worker Route `app.pinohouse.art/*` (NOT a Worker Custom Domain which competes with R2). Preserve public R2 on same path via `PINER_BRAND_R2`. Reverify original 4 assets before/after, rollback route on any regression.
5. Identity G4/Core contract remains external. Do not represent shell as authenticated app.

Current GitHub source repo: https://github.com/vmtct/pino-team-os
Epic: https://vmtct97.atlassian.net/browse/PAP-1746
Task: https://vmtct97.atlassian.net/browse/PAP-1943
