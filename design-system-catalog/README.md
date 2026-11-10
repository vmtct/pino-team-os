# PINO BO Design System — Staging Catalog

## Authority

- **Sole visual authority:** authenticated BO Staging at `https://bo.staging.pinohouse.art/bo`.
- Production is legacy. Neither production CSS nor the older prototype is a design authority.
- The catalog publishes at `https://ds.staging.pinohouse.art/` on **isolated Worker** `pino-bo-ds-staging`, with **no Core, D1, outbound or production bindings**.
- Catalog code is imported from the same `pino-team-os` source as BO Staging. Initial verified source snapshot: **5848b0e** (2026-10-26).
- The exact BO UI implementation is `app/bo/components/registration/BoRegistrationWorkspace.tsx` (with `BoDataTable`, `BoQuickView`, `BoFullDetail`, `BoTableSettings` and `BoViewTabs`). Do not confuse it with the separate generic `BoDataGrid` package.

## CSS authority

The build copies the **six original BO Authority CSS files** unchanged from `public/bo-authority-source/` in this repository, in their exact runtime order:

1. `styles.css`
2. `playground.css`
3. `playground-v22.css`
4. `playground-v23.css`
5. `full-detail-v24.css`
6. `full-detail-v25.css`

`catalog.css` is scoped only to `ds-*` inspection controls. Its overlay is suppressed while Quick View is open so it cannot block BO buttons.

## Build & deployment

From this repository with dependencies installed, run:

```powershell
node design-system-catalog/build.mjs
node design-system-catalog/package-worker.cjs
```

The first command bundles the **original React BO components** using esbuild and copies original styles; the second creates `worker-script.txt` with compressed static assets and a decompression pipeline. Upload the resulting Worker code to **only** `pino-bo-ds-staging` and retain existing `ds.staging.pinohouse.art` domain. Do not deploy this catalog over `pino-team-os-staging`.

The catalog has no automatic live synchronization. A code change to BO Staging requires rebuilding and redeploying DS from the **same source revision**. Add source SHA and visual-parity receipt to the release workflow before considering this a fully automated living system.

## Fixture and boundaries

- Fixture data is generated in-browser, synthetic, and intentionally not related to any real PINO student, staff, or D1 record.
- The `source` prop overrides BO's Core adapter. No live read/write requests occur.
- `BoRegistrationHistory` is replaced with a visible fixture-only placeholder to prevent audit API reads in public DS; `LogoutButton` is stubbed because this is the BO (not HO) surface.
- Actual runtime navigation, table, Quick View, Settings and Full Detail use the imported React components.
- The floating **DS Catalog** inspector lists runtime DOM selectors and reports bounding boxes, computed font size, gaps and padding. Use `?module=students&clean=1` for a controls-free screenshot.
- Font Awesome iconography is **not** yet canonical in this BO runtime: some components render Unicode glyphs. Do not invent substitute icons in DS. Requires separate semantic icon registry/component adoption.
- This is a source-identical component/style implementation, **not a claim of screenshot pixel parity with an authenticated live BO Staging session**. The latter requires authenticated side-by-side capture and measurement.

## Checks

- `node design-system-catalog/audit.cjs` — local 390/768/1440 Table → Quick View → Full Detail.
- `node design-system-catalog/audit-domain.cjs` — same flows against deployed DS domain.
- `node design-system-catalog/audit-extras.cjs` — live module change, table settings/properties, and byte-for-byte checks of all nine deployed assets.
- CI should eventually automate runtime screenshot parity at 390 / 768 / 1440, on each BO Staging revision, plus icon/a11y checks.

Initial checks (2026-10-26): 390/768/1440 each displayed 8 rows, 6 Drawer property rows and Full Detail; zero JS/request errors. Live domain had 9/9 binary asset integrity matches; Settings and 9 property controls were verified at 390 and 1440.

## Safety

Only update the dedicated DS Worker. Never modify BO staging backend, D1, Core, outbound notifications, or Production during DS catalog publication.
