# HO staging — CSS consolidation (2026-10-27)

## Active CSS contract
- The HO host loads exactly one authenticated asset: `/bo-skeleton/ho-scoped.css`.
- Inputs are the six frozen CSS files from `public/ho-authority-source/manifest.json` in their historical order followed by the HO theme (`app/ho/ho-theme.css`).
- `scripts/build-ho-authority.mjs` verifies frozen-source SHA-256 hashes and generates `public/ho-authority-source/ho-scoped.css`.
- `--check` runs in PR CI. CSS selectors are gated by `html[data-surface="ho"]` with zero added specificity; `:root`, `html`, `body`, `*` and keyframes receive appropriate special handling.
- HO styling is isolated from BO V2.5 and the legacy TOS pipeline. Authentication remains the existing `serveBoSkeleton` host-specific rule.
- HO theme semantic variables remain the single source for Burgundy brand colors; they are applied at the end of the generated asset. The former Next CSS import is removed to prevent a duplicate style pipeline.

## Intentional non-goals and remaining debt
- Historical CSS source fragments remain in the repo solely for deterministic compatibility/provenance, **not loaded** by the host.
- No visual redesign, CSS declaration deletion, markup/schema/API changes or cross-app component migration.
- The legacy declarations and `!important` overrides have intentionally **not** been deleted: consolidation and scoping do not prove a given override is redundant. This requires visual evidence and follow-up before safe removal.
- Tests assert identical declaration and at-rule order, host scoping, single authorized CSS delivery, BO/HO isolation and historical SHA preservation.
- Browser pixel-parity/E2E remains **not run** under the existing Founder PAP-1022 pre-production restriction. Staging review is required before calling visual parity complete.
