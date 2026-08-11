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
```bash
npm install @opennextjs/cloudflare
npx opennextjs-cloudflare build
npx opennextjs-cloudflare preview
npx wrangler deploy
```

Set `NOTION_TOKEN` and database IDs as Cloudflare Worker secrets/variables. Never commit `.env.local` or `NOTION_TOKEN`.

Health check: `/api/health`

Authentication must be added before exposing staff data publicly.
