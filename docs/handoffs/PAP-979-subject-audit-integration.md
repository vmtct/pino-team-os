# PAP-979 minimal History integration

Feature-Code: PLT-BO; Feature-Id: bo-operational-read-plane; Project-Code: PRJ-PLT.

Own isolated branch feat/pap979-subject-audit-history starts at #848 exact 13528ac4ff74d971e831ed19310256fbc83d57a1; #848 remains based on #845. This is an additive PR, not a rewrite/restack of #845/#848. FC1's #847 /bo React scope and worktrees are untouched.

Both approved Students/Classes replica pilots still use one existing shared Full Detail renderer. Core mode now passes the adapter's subject-scoped reader into the existing race-safe History controller. Student mapping is explicitly student_profile; Class remains running_class; exact selected row ID is used. UI-only Student mocks retain their existing student vocabulary so approved parity remains unchanged. Search/pagination go to the server; Core results are not filtered against browser mock data. Equal-time results must also descend by event ID. Switching entity/search discards stale responses and clears prior rows.

The exact BO-only facade GET /api/bo/audit/subject forwards the current authenticated session over PINO_BO_CORE to private GET audit/subject with a bounded body. Unknown/duplicate/identity/tenant/Center query fields are rejected. No generic audit path is added. Core errors propagate; adapter/controller expose loading/empty/403/409/error states and never substitute fixture rows. Actor labels and outcomes are localized; the CORE technical badge is removed from Core History without changing mock presentation, CSS or approved Table/Drawer/Settings/Shared Views.

Request: subject_type=student_profile|running_class; subject_id=lowercase UUIDv7; query <=120; limit integer 1..50 (default50); opaque cursor <=2048. Response data.events is the exact subject projection plus nextCursor. Core returns generic actor_label, actor_id:null, action label, normalized outcome and null/redacted descriptions/field/before/after. The UI displays missing values as em dashes; it does not invent before/after changes.

Core prerequisite: implementation PR https://github.com/vmtct/pino-core/pull/1837 at 0e576d8f0ca8dcf140eaa1765fa4409c8ff2e0c6 and registered bo-operational-read-plane-subject-audit-pap979 amendment. Center-only Student readers receive 403; scoped Class readers receive 409 for unproved historical Center provenance. These are intentional security denials and an explicit functional acceptance limitation, not a mock fallback or staging success.

Team Surface Decision: surface BO; primary_device DESKTOP; sidebar_group SCHOOL; navigation inherited; primary_layout TABLE -> Drawer -> Full Detail; canonical Core permission_context; Founder layout APPROVED for V2.5. No 29-module adoption, domain mutations, schema/secret/binding changes or FC1 React redesign.

Validation receipts and exact SHAs/CI belong in PR/Jira. Local fixture/parity evidence is distinct from REAL STAGING API PASS. New Core History screenshots are contract fixtures; immutable registration comparisons test only the approved renderer baseline. FC1 owns #845 -> #848 -> this Team follow-up lineage, combined exact-head CI, React #847 reconciliation, Core-then-Team staging promotion, serving versions/rollback and real Manager/Staff acceptance. Stop at DEV_HANDOFF_READY; no merge/deploy/Production/outbound. INDIE_WAIVED_BY_FOUNDER (PAP-507).
