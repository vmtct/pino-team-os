# PAP-879 — canonical three-level UI-only pilots

Students and Classes now enter the same `playground.html` workspace as the approved Hồ Sơ Đăng Ký reference. `index.html` loads a small same-origin entry router only for these two modules (including the existing default Students entry). Other module entries retain `app.js`. Query/fragment values are preserved; an arbitrary module cannot select an external destination.

The approved workspace in `playground.js` supplies shared `BODataTable`, `BOQuickView`, `BOFullDetail`, Settings, view state and existing local typed editors. `bo-pilot-adapters.js` provides only synthetic records and field metadata. Both pilots consume this same renderer and unchanged `styles.css` / `playground*.css` tokens. Reference registration remains the default when no recognized pilot is selected. Prototype helpers retained in `bo-design-system.js` remain compatible with the other mock modules; they are not another pilot renderer.

This removes the old pilot-only table density, Drawer markup, and invented generic Full Detail workflow panel. Pilot detail properties use their module schema; the reference's formula slot becomes an immutable mock record ID for pilots. Shared view changes remain in-memory mock state and reset on reload. No Core APIs, business persistence, role authorization, external effects or registration/enrollment commands are introduced. Controls already implemented in the canonical prototype retain those local interactions; no absent domain command is wired or simulated as a successful business operation.

## Team Surface Decision

```yaml
surface: BO
primary_device: DESKTOP
tos:
  app_family: NONE
bo:
  sidebar_group: SCHOOL
  subnavigation: [Học viên, Classes]
  primary_layout: TABLE
shared:
  permission_context: Existing protected preview ingress; UI-only synthetic data, no ACL changes
  cross_domain_links: Existing prototype navigation only
founder_layout_review: PENDING
```

The three-level reference frame is already approved; this candidate's Students/Classes presentation still requires separate Founder UI approval. This is prototype convergence, not adoption of the real BO runtime routes or authority to wire Core. Remaining module adapters, TOS, staff and Production are outside scope.

## Verification

- `node --test public/bo-ui-replica/*.test.cjs` covers existing shared output escaping plus pilot routing/open-redirect and identity/schema checks; included in existing PR Validation job.
- `node scripts/verify-bo-ui-replica.mjs` is an optional local browser diagnostic. It serves only static fixture files and asserts typed commit/cancel, Drawer/Full Detail/tabs/back, Settings/filter creation, local saved views, reload reset, responsive containment and absence of API/external network calls. It does not require or grant staging credentials.
- Local authority reference: initial byte-identical replica commit `a29227c0fff7bead77018182c10069ace5a76231`, ten UI asset hashes verified against `docs/bo-v23-ui-authority.json`. Three non-UI files are absent from that copy; no 13/13 claim.
- Diagnostic matrix: reference/current registration/Students/Classes × Table/Drawer/Full Detail × 390/768/1440, height 1000, locale vi-VN, UTC, Chromium. 36 screenshots; no page errors or document overflow. Reference registration component region matches all nine baseline screenshots pixel-for-pixel. Desktop sidebar input rendering is excluded from this component comparison; no full-page byte/pixel identity claim for pilot-specific data or navigation.
- Before/after evidence is attached to the delivery receipt; screenshot comparisons are diagnostic evidence, not a new global premerge browser gate.

Terminal requires immutable candidate + exact-head CI and the applicable merge/staging owner gates, actual serving SHA/version/rollback readback, followed by explicit Founder UI approval. Only after that approval may DS V1 be frozen and separately authorized Core adapters be wired. Production remains HOLD.
