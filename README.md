# PINO Team OS

Internal PINO Team portal powered by Next.js, Cloudflare Workers/OpenNext, Notion-backed operational data, and private `pino-core` integration for Core-owned Founder operations.

## Role

`pino-team-os` owns internal staff/founder UX, authentication/session composition, and application-specific orchestration. It is not the global source of canonical PINO domain rules.

Authority is per domain: explicitly unmigrated staff/ops domains may remain Notion-backed, while domains implemented canonically in `pino-core` must use Core contracts and Core/D1 state as their authority.

## Start here

1. `AGENTS.md`
2. `docs/architecture.md`
3. `PROJECT.md`
4. `DATABASE.md` for current Notion-backed staff/schedule contracts
5. relevant source/tests
6. `pino-core` architecture docs and ADRs when touching a Core-owned capability

## Stack

- Next.js
- TypeScript
- Notion API
- Cloudflare Workers / OpenNext
- private `pino-core` Service Binding for Founder operations
- GitHub

## Local

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Cloudflare

```bash
npm install @opennextjs/cloudflare
npx opennextjs-cloudflare build
npx opennextjs-cloudflare preview
npx wrangler deploy
```

Set required Notion and environment configuration through Cloudflare secrets/variables. Never commit `.env.local`, tokens, or other secrets.

Health check: `/api/health`
