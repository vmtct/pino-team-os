# PAP-1117 — HO Staff shared properties pilot

Approved visual source: shared DS PR #2 / PAP-1155, source main `3fd9c166b72b82bdf872a29519cd92217d96dc77`. The 0.3.0-rc.1 archive is pinned by config/pino-shared-ds-consumer.json and its SHA-256 is checked by the consumer contract test. This candidate has no release tag.

HO Staff keeps the existing TDD controller, registered schema, DetailFrame, tabs and history. The optional detailProperties presentation seam receives only recordProjection's authorized fields/values and filtered section membership. It runs only in a ready, readable Overview. Default rendering for every other consumer is unchanged. This seam does not grant mutation authority.

StaffRoleAccess maps those fields into the package PropertySections. Name/status stay readonly. Access role uses the existing unique linked account and single non-Founder assignment conditions; self, inactive, ambiguous and multiple-assignment states remain readonly. The existing HO role facade and Core authorization remain authoritative. The adapter preserves scope, assigns the new role before removing the old assignment, reloads server truth, and never reports partial success as saved. Changing record unmounts the old editor. Once a two-command write has started it completes both commands even if the view closes.

For subsequent developers:

1. Register fields, permissions, section membership and business tabs in the TDD schema. Preserve system Overview first and History last.
2. Reuse package metadata/components for the label/value grid and anchored editor. Do not recreate property rows with local selects or route CSS.
3. Keep domain loading, permission checks and commit/readback adapters in the application. A successful HTTP response alone is insufficient to acknowledge a saved value; reconcile the returned server state.
4. Version/pin the package archive and update the digest test. Never edit vendored generated package files or the approved authority CSS.
5. Run typecheck, lint, unit and TDD authority gates. Run `npx playwright test e2e/pap1117-staff-properties.spec.ts --workers=2` with the matching installed Chromium. This suite intercepts all application requests at a synthetic HTTPS origin; no real permissions are changed.
6. After repository admission, verify exact main CI, staging CD, serving SHA and authenticated read-only geometry on the actual HO record. Prototype and fixture screenshots alone do not prove staging delivery.

This is one application pilot. It does not claim that all PINO or LuuDo TDD surfaces have migrated, or that every registered field type is supported by the new editor. General enforcement and further consumers need their own scoped adoption.
