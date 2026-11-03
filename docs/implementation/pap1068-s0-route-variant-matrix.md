# PAP-1068 — S0 BO/HO Route & TDD Variant Inventory (provisional v0.1)

**Epic:** PAP-1067 Shared TDD. **G3 partner:** PAP-1073. **As-of:** 2026-11-03 (Asia/Ho_Chi_Minh). **Repository baseline:** Team main SHA 4cf07232c519bd80ccfda50876701141844d468f. **Deployment readback:** Team Staging Worker 100% at the same SHA, guarded CD #41630720335 (checked after sampled browser navigation). **Authority:** i5 authoritative BO prototype http://192.168.1.6:8799/playground.html, HO prototype http://192.168.1.6:3562/prototype, and authenticated BO/HO Staging. No Production access or mutation.

## Status vocabulary and coverage denominator

- **TDD_SOURCE:** route/component explicitly instantiates authenticated shared TDD SurfaceWorkspace; browser acceptance remains separate.
- **LEGACY_GENERIC:** existing BoRegistrationWorkspace/HoWorkspace generic Table/Drawer/Detail. Functional does not imply TDD schema or G3 conformance.
- **SPECIALIZED:** domain-owned UI or special reference; not automatically a Founder-approved TDD exception.
- **FACTORY_GENERIC:** BO factory shell/legacy view, not admitted to TDD by its module registry alone.
- **TDD_PILOT:** explicitly staging-gated route with typed TDD renderer, not canonical default.
- **UNVERIFIED:** source, URL and actual mounted runtime not all independently reconciled. Do not count as compliant.

**Provisional denominator:** 15 *observed BO Staging nav targets* + 17 *observed HO Staging nav targets* = 32 navigable targets. Includes only mounted navigation; some direct staging-only BO routes are **additional** and must not be counted as the same target. This is NOT the final eligible TDD denominator. S0 must enumerate deployed hidden direct routes, deduplicate path/query aliases, and classify actual special screens and grandfathering before closure.

## BO — observed Staging navigation (15 targets)

| Key / Staging entry | Classification from source/runtime | Center, auth and pilot gate | Delivery owner / open evidence |
|---|---|---|---|
| Students — /bo | LEGACY_GENERIC | Core-scoped Center; cold session without Center shows explicit pending state | PAP-1075; BO Center UX PAP-1316 |
| Parents — /bo?module=parents | LEGACY_GENERIC | MIXED Core scope; ordinary URL not TDD | PAP-1075 |
| Parents pilot — /bo?module=parents&pilot=tdd | **TDD_PILOT, not another nav target** | APP_ENV=staging, BO_UI_ONLY=enabled, canonical BO host; choose Core-authorized Center via UI. TDD Table rendered in i5 browser. All 7 authorized Centers returned Core directory HTTP 200; six Center totals 0, one Center total 1. A real Core-authorized Parent in that Center yielded Table→Drawer→Full Detail→Back PASS and four system/business tabs present (Tổng quan, Học viên, Liên hệ, Lịch sử); 390/320px no document overflow. Full five-width / business content negative ACL not yet signed off | PAP-1075; not a G4 full-pass claim |
| Running Classes — /bo?module=classes | LEGACY_GENERIC | Center-scoped | PAP-1075 / domain |
| Subscriptions — /bo?module=subscriptions | SPECIALIZED | MIXED center boundary; embedded dedicated BoSubscriptionsView | Subscription Epic; not forced TDD |
| Enrollments — /bo?module=enrollments | LEGACY_GENERIC | MIXED, not globally auto-admitted | Domain |
| Student Visits — /bo?module=visits | LEGACY_GENERIC | Center-scoped read adapter | Domain / PAP-1316 scope |
| Missions — /bo?module=missions | TDD_SOURCE | Explicit BoMissionsTdd branch | Mission Epic; PAP-1073 assembled geometry |
| Staffs — /bo?module=staffs | LEGACY_GENERIC | Workforce ACL | Workforce / Staff Epic |
| Timekeeping — /bo?module=timekeeping | LEGACY_GENERIC / specialized business workflows | Center-scoped domain; grandfathering/ROI decision | PAP-1306, PAP-1311 |
| Shift Plans — /bo/workforce-shift-plans | FACTORY_GENERIC | Center-bound workforce read | Workforce epic |
| Staff Availability — /bo/workforce-availability | FACTORY_GENERIC | Center-bound workforce read | Workforce epic |
| Shift Assignments — /bo/workforce-assignments | FACTORY_GENERIC | Center-bound workforce read | Workforce epic |
| Payroll Periods — /bo/payroll-periods | FACTORY_GENERIC | Explicit read route; no assumption of salary write rights | Payroll epic |
| Audits — /bo?module=audits | LEGACY_GENERIC | Role/permission gated | PAP-1057 |
| Pinoria Self — /bo?module=pinoria-avatars | **UNVERIFIED route alias**; separate direct /bo/pinoria-avatars uses SelfDirectoryTdd | Observed sidebar query link differs from TDD direct route. Reconcile actual selected runtime before any consolidation | Pinoria Self Epic, not PAP-1067 shell |

**Counting note:** The table includes 15 BO nav items plus the additional Parents pilot row. The Pinoria Self row is one nav item, not two; route alias flagged deliberately.

**Additional source-admitted BO direct TDD routes not visible in the sampled 15-item nav:** /bo/classroom-diaries (BoClassroomDiariesTdd, Staging-only guard), /bo/open-studio-passes (BoOpenStudioPassesTdd, Staging-only guard), /bo/missions (BoMissionsTdd direct route), /bo/pinoria-avatars (SelfDirectoryTdd). They require their own actual route receipts and domain owner reconciliation; source existence alone is not a mounted/accepted route.

## HO — observed Staging navigation (17 targets)

| Staging route | Classification from Page source | S0/G3 evidence / owner |
|---|---|---|
| /ho/centers | TDD_SOURCE | i5 Founder live: 7 Quick View records, Table→Drawer→Detail→Back PASS, two Detail tabs present, no document overflow at 1440/1024/768/390/320; PAP-1076 and PAP-1073. Capture-time serving SHA not separately frozen, so don't claim exact-SHA visual signoff. |
| /ho/operating-cycle/global-terms | TDD_SOURCE | Global Terms epic; route acceptance pending |
| /ho/learning/diaries | TDD_SOURCE | HO Diary epic; route acceptance pending |
| /ho/system/tdd-reference | SPECIALIZED reference atlas | UI-only developer reference, not business TDD record |
| /ho/system/users | LEGACY_GENERIC | HO Founder-only; no forced migration |
| /ho/system/roles | TDD_SOURCE | HO Roles epic; specific ACL/edit scope separate |
| /ho/system/audit | SPECIALIZED paginated audit | HoAccessAudit, not default TDD |
| /ho/workforce/shift-templates | TDD_SOURCE | Workforce/Shift Template epic |
| /ho/workforce/term-weeks | TDD_SOURCE | Global TermWeek epic |
| /ho/open-studio/walkin | TDD_SOURCE | Open Studio epic |
| /ho/staff | TDD_SOURCE | Prior i5 authorized Founder manual Table→Drawer→Detail→3 tabs→5 widths→Back PASS on older attested Team SHA e08a4ae5; do not promote to new-SHA receipt. |
| /ho/learning/syllabi | LEGACY_GENERIC | Learning epic |
| /ho/learning/missions | TDD_SOURCE | Mission epic |
| /ho/pinoria/worlds | LEGACY_GENERIC | Pinoria domain |
| /ho/pinoria/wardrobe | TDD_SOURCE | Pinoria domain |
| /ho/pinoria/wardrobe-sets | LEGACY_GENERIC | Pinoria domain |
| /ho/pinoria/effects | LEGACY_GENERIC | Pinoria domain |

**Source-derived HO breakdown:** 10 TDD_SOURCE, 5 LEGACY_GENERIC, 2 SPECIALIZED out of 17 navigable pages. These are implementation classifications, not 10 live visual PASS receipts. Founder-only HO boundary applies to every route, regardless of shell.

## Authoritative prototype ↔ Staging observations

- BO prototype at /playground.html uses hash targets (sample: #students, #parents); BO Staging uses /bo plus module query and some direct routes. Match semantic module and interaction, **never compare URL equality as a visual gate**. Prototype observed 18 anchor targets, compared with 15 sampled Staging BO nav targets: difference is a coverage/feature-ownership item, not automatically a TDD engine defect.
- HO prototype at /prototype uses module query (sample ?module=centers). HO Staging uses dedicated /ho/* paths. Prototype observed 13 module nav links, compared with 17 Staging HO nav targets. Staff registration links and Bills are prototype modules; missing a same-label Staging nav entry is **not** proof of a PAP-1067 defect. Reconcile with domain Epic / HO–BO CRUD matrix.
- BO Students /bo fresh authorized session with no selected Center renders explicit 'Chọn cơ sở' status, not a Table; existing top-left Center chooser belongs PAP-1316. Do not invent Center or mark a blank table as an engine bug.
- BO Parents canonical generic view rendered Quick Views (sampled 2); pilot route rendered typed Table after authorized Center selection. Read-only Center scan with real Core directory receipts found one authorized Parent across seven Centers (HTTP 200 for each). Focused Founder TDD pilot Table→Drawer→Full Detail→Back **PASS**, four tabs present; responsive 390/320px no overflow. This is a focused positive receipt, NOT full five-width/negative ACL acceptance.
- HO Centers and HO Staff typed TDD Tables rendered under an existing authorized Founder session; no session/PII export. Generic HO pages are not retroactively TDD merely because visually similar.
- All sampled browser interactions were read-only. Temporary i5 CDP tabs were closed at the end of each probe; existing Founder tabs left unchanged.

## G3 and delivery receipts

- **G3 fixture geometry:** GitHub Actions #41630715350 completed SUCCESS on source SHA 4cf07232c519bd80ccfda50876701141844d468f. Measured geometry, negative controls, pixel comparison to Founder-approved immutable fixture golden, artifact verifier and upload ALL SUCCESS. Artifact pap1073-g3-geometry ID 13227523818 (2,457,936 bytes) available at audit; workflow enforces 30 PNG and 10 geometry JSON. Historical Founder-approved golden set: #40811677302.
- **Team Main / Staging delivery:** PR Validation #41630076632 SUCCESS; guarded Team Staging CD #41630720335 SUCCESS; independent Cloudflare Worker deployment was 100% source SHA 4cf07232c519bd80ccfda50876701141844d468f when last checked. Earlier isolated CD attempts failed; only successful latest deployment counts.
- **G4:** Founder-approved scope exception PAP-1074: historic GitHub #41606782509 on SHA e08a4ae5 9/10 automated cases PASS, overall workflow FAILURE; separate legitimate Founder manual HO Staff positive PASS. Combined G4_ACCEPTED_SPLIT_EVIDENCE only for this scoped G4, **not** automated 10/10 PASS and not a new-SHA G4 receipt.

## Gap / ownership ledger — no indiscriminate code changes

| Gap | Evidence / risk | Owner and next acceptance |
|---|---|---|
| S0 denominator beyond nav | Direct routes and aliases need independent mounted-host checks; no invented eligible total | PAP-1068 with PAP-1086/1087; finish route inventory |
| G3 live prototype visual | Fixture/pixel CI PASS cannot prove all actual BO/HO surfaces match i5 visual authority | PAP-1073; Founder preview/visual approval of exact pages and five widths |
| Parents TDD pilot full gate | Real Core-scoped Parent located; Table→Drawer→Full Detail→Back PASS, four tabs present at 390/320px without overflow | PAP-1075: finish 1440/1024/768 geometry, verify each tab panel's authorized data/masking and negative ACL; do not insert fixture |
| HO Centers ACL negatives | Positive Founder E2E is not proof of Manager 403 or role-revocation behavior | PAP-1337/PAP-1076; negative 401/403/404 and effective Founder-role audit; never provision non-Founder HO account |
| BO workspace Center UX | Cold session selection / navigation owned independently; no TDD inline selector requirement | PAP-1316 |
| Custom/special-screen evidence | Reference, audits and domain-specialized routes not automatically TDD-compliant or Founder-exempt | PAP-1085 registry; domain owner supplies exact exception |
| Generator and ROI | tdd:new-module and typed action-host tests exist; no three measured module cases | PAP-1077/PAP-1247/PAP-1311, ROI-gated; no new abstraction based only on this audit |

## S0 exit status

**S0_PARTIAL_ROUTE_INVENTORY**. This document is a versioned, source-backed snapshot; it does not assert full live-route coverage, pixel parity, negative ACL PASS, that all navigable routes should migrate, or Production readiness. PAP-1068 and PAP-1073 remain In Progress until remaining gap receipts and Founder visual acceptance. This doc changes no app runtime, ACL, credentials, fixtures, infrastructure or Production.
