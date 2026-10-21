# PAP-780 Staff parity source inventory — partial

Date: 2026-10-21. Source: Team OS main e4f7bf3.

Approved PAP-778 prototype is in i5 OneDrive/PINO/GPT Technical/Prototype/PAP-778-staff-detail-ux-v1. Its README explicitly states fictional in-memory mock data. Screenshots 01–07 depict the prototype; screenshot 08 shows an unauthenticated BO login redirect, not an authorized Staff Detail.

Current main app/bo/staff/page.tsx includes intake, registration review, Staff management, roster activation, onboarding. The canonical tab URL contract is lib/bo-staff-detail-tabs.ts with overview, profile, assignments, training, income, access, pinoria, audit. Other PAP-779 stories are on independent unmerged PRs and must not be claimed present on main.

Canonical domains: Workforce shift assignments; Training qualifications; Compensation private salary; Pinoria Self/House presence; Access credentials and revocation. Prototype KPIs, pay ledger, audit timeline are illustrative, not live facts. PAP-787 cross-center assignment read-model and PAP-791 paginated Staff audit aggregation are outstanding.

Windows CDP listener scan: only FC1 port 9331 was listening among policy ports 9331,9332,9333,9342,9343,9344. Independent read-only authenticated Manager session unavailable at 9343; FC1 listener must not be used. Therefore authenticated desktop/tablet/mobile screenshots and role-specific runtime parity are not verified. PAP-780 remains In Progress.

Next: authorized isolated Manager browser read-only audit at 1440/768/390; compare to approved prototype, log real URL/role and visual deltas. No claims of runtime PASS. PAP-792 cannot close until source/CI/merge and acceptance evidence is complete. No staging or Production action.
