# PAP-979 — Four live school tables at /bo

Scope: Students, Running Classes, Subscriptions, Enrollments. Enrollment links Subscription and Running Class; no separate Path module or mock navigation is exposed.

The sole presentation authority remains Hồ sơ đăng ký / playground.html and its six stylesheets. All eight pinned authority files are byte-identical. school-adapters.js supplies only field metadata and canonical read data. skeleton-bridge.js configures the original shared table, Quick View, property grid and tabs without new CSS, inline style or other-module renderer.

Staging-only /bo rewrites internally to the authenticated controller; /bo-skeleton/playground.html redirects to /bo, preserving the module query. Production and other hosts are excluded. A base URL resolves existing assets without changing their source files.

Reads:
- Students: canonical learners cursor directory.
- Running Classes: delivery/bootstrap-state (current admitted Core ACL).
- Subscriptions: canonical subscription directory and cursor.
- Enrollments: scoped BFF projection of one subscription page and each unique student's independently authorized lifecycle, at most four concurrent reads. Return only rows bound to visible subscription IDs; no guardians, billing/private lifecycle data. Subscription-page cursor is retained, not a fabricated enrollment total. Upstream 401/403/409 deny the whole page; no partial results or fallback mocks.

These are read-only tables. Quick View and Detail reuse loaded rows. Chuyên Sâu / Lịch Sử explicitly remain unwired with no fabricated events. Search/filter/sort/column configuration operate locally through the authority renderer. Create/edit stay disabled.

Founder authorized synthetic staging population in namespace PAP979-UI-20261025: one space, three classes, three subscriptions, three enrollments at Staging Delivery Syllabus using two existing synthetic students. Founder separately approved CENTER-only delivery.future_reservation.v1 maxDaysAhead:0 (PAP-979#16202); GLOBAL and real centers are untouched. Canonical create and readback passed; the exact-ID mutation ledger and cleanup boundary are retained in private Jira evidence. No direct database, migration, secret, outbound or payment operation.

Validation: targeted adapter/BFF/auth/routing tests, unchanged authority source digests, and Playwright screenshot checks at 390/768/1440 for four tables, Quick View, three tabs, filter controls, cursor traversal, 403/409 and overflow. Local evidence is separate from authenticated staging acceptance. INDIE_WAIVED_BY_FOUNDER (PAP-507).

Release only from current main with successful exact-SHA push CI through pap979-school-live-staging.yml, under a recorded staging writer lease. CAS checks previous Team/Core versions and guarded rollback; deploy only Team staging. Production HOLD, PAP-971 HOLD_OUTBOUND.
