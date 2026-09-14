# PINO Team OS

Internal PINO Team portal powered by Next.js + Notion + Cloudflare Workers.

## Status
v0.1.1 — production foundation

## Stack
- Next.js
- TypeScript
- Notion API
- Cloudflare Workers / OpenNext
- GitHub

## Local
```bash
npm install
cp .env.example .env.local
npm run dev
```

## Cloudflare
Local build/preview is allowed, but production traffic promotion is not a CLI/manual deploy path:
```bash
npm install @opennextjs/cloudflare
npx opennextjs-cloudflare build
npx opennextjs-cloudflare preview
```

Cloudflare Builds for `main` may only create an immutable non-serving candidate using the command pinned in `ops/team-production-build-boundary.json`. Production traffic may be promoted only by `.github/workflows/team-runtime-production-release.yml` after its exact Founder authorization, provider, build, recovery, and serving fences pass. Direct `wrangler deploy` / `wrangler versions deploy` to `pino-team-os` is outside canonical authority.

Set `NOTION_TOKEN` and database IDs as Cloudflare Worker secrets/variables. Never commit `.env.local` or `NOTION_TOKEN`.

Health check: `/api/health`

Authentication must be added before exposing staff data publicly.
