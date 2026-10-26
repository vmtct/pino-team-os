# BO V2.5 — Canonical CSS Authority

Task: PAP-1019, Founder-authorized 26/10/2026. One active Design System anchor: **Hồ sơ đăng ký**.

Entry: playground.html. Active stylesheet: **styles.css only**. The five historical CSS filenames are compatibility tombstones, not additional styling sources. index.html redirects to the same anchor. Do not restore archived applications or independently maintain another prototype.

## Source contract

CSS_AUTHORITY.json pins the immutable HTML/JS/CSS hashes, original baseline, token registry, breakpoints and known limits. Revalidate hashes before runtime adaptation. The previous PAP-986 JS hash 7a2d1d3d394660eb1b0680a1d4bb8041bee1a132a8ff8c22d5179a63f3fdd9cc is now a pre-cleanup baseline, not the current source.

styles.css is organized into semantic tokens, exact supporting palette, native controls, BO shell, shared values/buttons, Table/views, Settings/filters, Quick View, Full Detail/history, typed editor and utilities. Colors and measurements remain exact unless explicitly listed below. The supporting palette preserves existing hues rather than inventing an unapproved redesign. Component styles contain no raw HEX colors. Shared font, dimensions and overlay roles have --bo-* tokens.

## Intentional presentation fixes

- Search, Settings search and History search show a keyboard focus ring on their wrapper.
- History outcome stays visible below 950px in a compact extra grid row.
- Editor padding remains exactly 14.25px, and 13.3px at <=450px.

## JavaScript boundary

Colors and static empty-state typography moved to classes. Schema width is an input custom property --bo-column-width. Popover/menu viewport geometry and scroll locking remain dynamic. No business/API behavior was moved into CSS. All records and edits remain local browser mock state.

## Staging / future Production BO consumption

Use this source as the visual contract for the existing shared React shell/Table/Drawer/Settings/Full Detail/editor. Scope tokens to the BO design-system root and overlay portals in runtime; do not import this standalone prototype's global reset into TOS or unrelated BO modules. Map real domain schemas/ACL to shared components; do not copy fixture fields, events or mock persistence.

Use one admitted source artifact across environments. FC1 retains runtime integration/merge/staging ownership under PAP-512/PAP-979. This local source cleanup does not deploy staging or Production and does not approve a 29-module rollout.

## Verification and provenance

Static CSS parse/token checks, JS syntax and in-memory DOM/cascade differential receipts are recorded under evidence/PAP-1019-css-cleanup. These are targeted non-browser checks, not rendering/pixel parity, integrated E2E, real APIs or staging acceptance. Browser/integrated E2E did not run per Founder policy. Original source backup is under backup/PAP-1019-css-before-20261026 with SHA manifest.

Open playground.html directly or use the existing local server at http://127.0.0.1:8799/playground.html.

## PAP-1019 property-label alignment refinement — 26/10/2026

Shared create/Quick View labels use an 18px fixed icon gutter plus a flexible, left-aligned text column with baseline alignment and wrapping. This corrects different glyph widths shifting the label text. Field order, values, editor behavior and row/value column sizing are unchanged. Authority revision r2; targeted non-browser rule/DOM checks only. Prior source backup: ../backup/PAP-1019-property-label-before-20261026.

## PAP-1021 sidebar / center-switcher revision — 26/10/2026

Removed the separate brand block. The top sidebar control now shows the supplied PINO white logo from https://assets.pinohouse.art/core/Pino%20Logo%20White.png and current center. Dropdown selection, arrow/Home/End navigation, Escape/Tab/outside dismissal and focus return are local prototype behavior. Options PINO Cần Thơ / Trung tâm 02 / Trung tâm 03 are synthetic fixtures, not an authoritative center registry; switching does not change real auth/tenant/data or call Core. The shared property-label r2 alignment is preserved.

## PAP-1022 canonical responsive correction — 26/10/2026

Moved the existing 130px base property-row grid definition before its responsive variants. Effective label tracks: 102px at <=450px; 108px at 451–760px; 130px above 760px. Values are unchanged; only the erroneous cascade ordering is corrected. Fixed 18px label-icon gutter from PAP-1019-r2 remains. Imported runtime CSS must match this revised authority exactly, with deterministic surface scoping only. No staging-only responsive override.
