# PAP-1064 — GLOBAL Shift Templates (PAP-1198 / PAP-1199)

Founder decision 2026-11-03: collision policy B. GLOBAL and CENTER cannot share a
code, including INACTIVE and code edits; distinct Centers may share codes. Core
PAP-1235 owns enforcement. UI selection always uses template UUID, never code.

The existing HO module/BFF is extended, not duplicated. HO active Founder and
`workforce.shift_template.ho_manage` remain required. The explicit private Core
`shift-templates/ho` read accepts no scope filter for all records, GLOBAL/null
Center for shared records, or a canonical Center for local records. Mutations
carry explicit scope and nullable Center; existing Center-only payloads remain
readable during coordinated rollout. BO old mutation routes remain denied.

HO reuses the typed shared Table → Drawer → Detail adapter, pinned
`@pino/design-system` DrawerFrame and existing native controls. No CSS is added.
Scope/Center and status filters, GLOBAL option, create/edit drawers, usage counts
and authorized subject audit (latest 100, actor/time/action/before→after) are Core
readbacks. Referenced times are read-only in the form and protected at Core.
Scope/Center identity stays immutable on edit. Unknown API state shows unavailable
or error, never synthetic history. BO labels GLOBAL vs Center while preserving
the existing planner/Center switcher, UUID selection and Core ACTIVE-only union.

Team Surface Decision: HO authoring, BO consumption; desktop-first Workforce TDD,
existing grouped navigation and routes. TOS has no template authoring and keeps
its assigned-shift UI. No assignment publish/visibility change or role expansion.

i5 source provenance read 2026-11-03:
`C:/Users/ADMIN/OneDrive/PINO/GPT Technical/Prototype/HO-BO-V25-20261026/source`.
HoPrototypeWorkspace.tsx SHA256
`cfc36b7255748a928f91e75009aa5f7868b76f02954cef43372384cb769fb32c`;
prototype.css SHA256
`d8f137180ff632dd284d1c453d30ca1d3fa4e904c7ac01bea83cfe2d1cc0f7ad`.
The source supplies shared HO shell/DS authority; a dedicated GLOBAL template
prototype was not found. The explicit Jira/handoff defines fields and behavior;
canonical prototype files were not edited. Founder visual acceptance, responsive
runtime E2E and Staging serving SHA remain separate from source/PR CI.

Coordinated rollout requires Core 0163 and its permission-preserving API before
this UI. No merge, deployment, Staging/Production data mutation or actual E2E
acceptance is implied by these source changes. Keep both PRs Draft for review.

## PAP-1198 — Founder HO visual parity approved 2026-11-04 09:40 ICT

Feature Epic PAP-1064 / WFM-SHIFT-SCHEDULING. Founder approved the authoritative i5 HO Mẫu ca prototype at http://192.168.1.6:3562/prototype?module=shiftTemplates following removal of the ho-shift-summary counters and all settings-hint sections from that module. Evidence Jira PAP-1198 #21481 and PAP-1064 #21482; code review remains a separate L3 approval.

The Team implementation retains the protected global/center scope contract, server BFF and Core ACL checks. Its HO TDD uses canonical Table→Drawer→Detail; usage shows authorized count/scope/status fields without summary panels, edit displays inputs inside the Full Detail tab rather than an extra nested drawer, status stays in Full Detail, and the Core audit provider remains truth-based (no fake history). Do not extend the visual approval to Production or Team merge. This PR needs exact-head CI and a separately scoped Founder L3.