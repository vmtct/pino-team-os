# PAP-938 TOS VNext: authoritative V8 parity gap ledger (FC2, 2026-10-23)

## Frozen authority / evidence
- Canon on i5: C:\Users\ADMIN\OneDrive\PINO\GPT Technical\Prototype\PAP-934-tos-master-v3 (verified present independently of i3).
- V8 scope: TOS_VNEXT_SCOPE_AND_RELEASE_V8_2026-10-22.md; SHA256 BDA3CF216DDEAC26E1FA28C6E7734484DBD2C7E7143343162433C93D224EBF7C.
- Master route source: app/prototype/tos-master-v3/page.tsx; SHA256 A2DE7F0CCE1E61D91096E944350C4B091B242E5FE1BCEA975AAE71240B3DD9C4.
- Golden prototype evidence: qa/six-apps-v8/{pap934-v8-sixapps-e2e.cjs,results.json,home-six-390.png,home-six-1440.png}; prototype-only 40/40 checks; no runtime parity implied.
- Runtime baseline audited: Team PR #810, head 9fae00d9, draft, CI green. Source paths below are relative to repo.

## Source gap ledger (NOT a visual-PASS assertion)

| Surface | Master V8 contract | Runtime evidence | Classification | Next bounded action |
|---|---|---|---|---|
| Home | Exactly six tiles, approved V18b layout, gear/logout, icons/disabled states | TosVNextHome.tsx renders six registry tiles and gear, no screenshot match | VISUAL_UNVERIFIED | Side-by-side 390/1440 screenshot and interaction state check |
| Shared mobile shell | Reception-derived 60px image-icon header, 430px max frame; 44px targets, 76px dock, 15px body; contextual class detail header preserved | TosVNextUI.tsx and tos-vnext.module.css primitives exist, no computed-style parity receipt | VISUAL_UNVERIFIED | Capture computed geometry per app at 320/390/430/768/1024/1440 |
| Ca Lam | 4 tabs Today/Schedule/Hours/Income; check-in camera evidence in app | Existing PAP-700/799 clients; photo atomic Core PAP-868/869 pending | PARTIAL_RUNTIME / BLOCKED_CORE | Preserve approved screen structures, separate photo backend readiness |
| Tiep Tan | 3 tabs, approved Hôm Nay / Đón–Trả / Pinoria screens, open shift photo, pickup and role state | TosVNextReception.tsx renders assignment/read-visit-ID and disabled open/pickup/Pinoria cards | UI_DIFFERENCE / BLOCKED_CORE | Replicate approved flows first, keep write controls fail-closed, then wire PAP-759 contract |
| Tram TOS | Full-width desktop >=1024, five-sidebar workstation flows | TosVNextStation.tsx contains dependency-explanation cards for all tabs; no actual workstation | UI_DIFFERENCE / MISSING_CONTRACT | Build approved desktop views with truthful loading/disabled states, identify workstation APIs |
| Truong Ca | Role-gated app and shift duties/closeout | TosVNextShiftLead.tsx Core duty projection; actual screen parity unverified | VISUAL_UNVERIFIED / PARTIAL_RUNTIME | Compare V8 role states and closeout action matrix |
| Lop Hoc | Founder-approved V18b, class entry/detail, Học viên/Nhiệm vụ/Nhật ký, Path Diary and validation/media | TosVNextClassroom.tsx displays roster and disabled Mở Path Diary, no approved 3-tab class detail | UI_DIFFERENCE / BLOCKED_CORE | Reuse V18b approved presentation, implement full 3-tab flow; Core #1770 contract readback before mutation |
| Thang Tien | Purple, Thăng Tiến/Chứng Nhận exactly 2 tabs, catalog/register/eligibility/cert | TosVNextTraining.tsx reads V5 & qualification; Đăng ký disabled pending release | PARTIAL_RUNTIME / VISUAL_UNVERIFIED | Reconcile approved filters/sheets/labels, then Core #1793/#1794 read/write/readback |
| Forbidden Duty tile | NO standalone seventh app or ?app=duty | Six-app registry and no Duty tile in #810 | SOURCE_PASS / RUNTIME_VISUAL_UNVERIFIED | Add deterministic source/route fixture |

## Admission rules
1. A UI screen cannot be marked VISUAL_PARITY_PASS without paired golden/runtime evidence at the applicable viewport(s); a green CI, a token file, or an error/info card is insufficient.
2. Fix UI grammar and navigation to match Master V8 BEFORE considering any dependency-status card a satisfactory screen. Use isolated *visual harness* fixtures only for deterministic screenshots, never as business truth or staging transaction.
3. Separately prove Core read/write/readback, staff role, center, security, error/409 and private media for any functional slice; disabled backend actions remain FUNCTIONAL_BLOCKED rather than UI_DONE.
4. Staging still needs PAP-512 protected isolated staging actor, bindings/D1/R2, pinned SHA/rollback, and a specifically authorized PAP-938 staging scope. FC2 MUST NOT deploy or merge; FC1 merger only. No full browser E2E required by PAP-512 merely to stage; targeted screenshot comparison is acceptance evidence and final Production E2E stays future.
5. Prioritize Classroom V18b and Station structural deltas; maintain off-by-default diagnostic route and single-writer source ownership. Source matrix above is the initial inventory, NOT an exhaustive parity approval.
