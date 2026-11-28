# PAP-791 — Staff audit source authority / safe fallback

Canonical BO Team OS main has a paginated **Access Audit** route (/bo/system/audit) and other domain ledgers, but no verified unified Staff-scoped audit read model offering Staff ID + timestamp/actor/source/action and safe cross-domain pagination/ACL. Access audit browsing is not a complete Staff employment history.

This PR replaces the generic Staff Audit placeholder with an explicitly labeled Staff ID and deep links into existing Core-authorized Access Audit, Training and Workforce screens. It deliberately does NOT fetch global audit records to filter in the browser, leak other Staff events, create client-side history or pretend event completeness. Staff identifier is printed locally for operator cross-referencing; server sources remain authoritative.

**Outstanding Core/API dependency request:** Introduce authorized, paginated Staff-specific audit projection accepting an immutable canonical Staff ID, joining only permitted Staff profile, Access, Training, Workforce and private Compensation audit sources server-side with correct permission scopes and redaction. Response must include actual actor/action/source/time and cursor/total without prefetching salary or other private data. Until implemented, Staff Audit is a safe link-only fallback, NOT a complete timeline; request must be explicitly triaged before full product acceptance.

TypeScript/ESLint/diff gates and exact-head CI to confirm. Founder PAP-512 browser E2E optional premerge; no authenticated runtime or Production proof claimed. FC1 sole merger, must reconcile other StaffManagementView PR edits, PAP-507 waiver and security, then read back merge SHA and Jira before Merged.
