# PAP-938 — Prototype-to-runtime parity gap ledger (CP0/CP1)

Status: **AUDIT_ONLY / NOT_PARITY_PASS**, 2026-10-23. Runtime head baseline: `9fae00d9` (Team PR #810). Prototype local canon: `C:\Users\ADMIN\OneDrive\PINO\GPT Technical\Prototype\PAP-934-tos-master-v3`. Current authority PAP-934 **V8** + Design System V1, not superseded V5/V7 notes. PAP-512 has staging four-gate and FC2 premerge-only fences.

## Authority checksum (snapshot from independent i5 OneDrive)
- TOS_VNEXT_SCOPE_AND_RELEASE_V8_2026-10-22.md | SHA256 BDA3CF216DDEAC26E1FA28C6E7734484DBD2C7E7143343162433C93D224EBF7C
- app/prototype/tos-master-v3/page.tsx | SHA256 A2DE7F0CCE1E61D91096E944350C4B091B242E5FE1BCEA975AAE71240B3DD9C4
- app/prototype/tos-master-v3/TOS_DESIGN_SYSTEM_V1.md | SHA256 51253ADFD2AA98BCF0BECCD0BF0AF0C37B1C276A8914AB608E8CC6E8155BD767
- qa/six-apps-v8/pap934-v8-sixapps-e2e.cjs | SHA256 707E81E4584812B71B31076B775C957524055ECA08A85E1F7307C7F0B1B9BE3D
These hashes are **source identity only**; no live screenshot equality is implied. The prototype QA run 40/40 was prototype-local, not runtime equivalence.

## Known source gaps, not a visual screenshot verdict

| Surface | V8 authority interaction | PR #810 runtime observation | Verdict and owner |
|---|---|---|---|
| Home | Exactly 6 tiles in approved order; gear/logout; icon/disabled role; approved layout | Six tiles and existing Home CSS integrated, Core auth gating | PARTIAL — FC2 must compare rendered Home screenshot / disabled roles |
| Ca Làm | Four tabs Hôm nay/Lịch ca/Giờ công/Thu nhập; camera check-in; pay history | Authenticated Workforce/Timekeeping/Income reads | PARTIAL; photo writes BLOCKED_CORE PAP-868/869; FC2 screenshot/interaction audit |
| Tiếp Tân | Three tabs Hôm Nay/Đón–Trả/Pinoria, approved opening/proof/pickup flows | Shift and Student Visit ID read; opening, pickup, Pinoria writes disabled | STRUCTURAL_DIFF; FC2 restore all visual screens; Core PAP-759/related contracts for writes |
| Trạm TOS | Full desktop workstation/sidebar at >=1024: Overview/Pinoria/Students/Devices/TV | Desktop shell/sidebar exists, but workspaces are dependency explanatory cards | STRUCTURAL_DIFF; FC2 reproduce source visual regions, PAP-943 Core device/TV truth |
| Trưởng Ca | Role-disabled Home tile until capability; shift-leader contextual operations | Core own duty/closeout read; writes withheld | PARTIAL; FC2 compare disabled/authorized states; PAP-671 Core owner |
| Lớp Học | V18b original; list/detail, three bottom tabs Học viên/Nhiệm vụ/Nhật ký, Path Diary register/close/media, one contextual detail header | Source component renders Core roster and V18b three-tab interaction (Học viên/Nhiệm vụ/Nhật ký), but Mission/Diary remain fail-closed until Core truth | PARTIAL P0; FC2 restore original V18b layout/forms and screenshot parity; PAP-724/723 write truth |
| Thăng Tiến | Purple 2 tabs Thăng Tiến/Chứng Nhận; catalog/detail/register and certificate journeys | Core V5 catalog/read + two-tab structure; registration disabled, visible dependency text | PARTIAL; FC2 compare visuals; Core PAP-848/849/850 for writes |
| Global DS | 430px centered mobile frame, 60px app header, 76px bottom nav, 44px touch, 48px CTA, correct assets; Station full desktop | Shared primitives exist; no paired screenshot/computed typography receipt | UNVERIFIED; FC2 runtime screenshot+measurement parity at 320/390/430/768/1024/1440/1920 |

## Next executable sequence (not an additional staging bureaucracy)

1. **First UI source:** reuse pinned React Master V8 layout and original V18b Classroom composition, rather than synthesize simplified DTO-driven cards. Add necessary real-core adapters within that composition, preserving fail-closed mutations.
2. Create **paired** source screenshots and deterministic runtime *visual harness* screenshots per app/state/breakpoint. Fixture visuals are diagnostics only; never business truth or real staging write acceptance.
3. For every clickable visible prototype CTA: classify `REAL_CORE_READBACK`, `FAIL_CLOSED_BLOCKED`, or `UI_ONLY_NAVIGATION`; preserve correct visual control placement even when blocked. No fake success.
4. Build automated component/geometry/interaction checks plus annotated visual diffs; **do not claim visual PASS without screenshots**. Verify actual Core permissions/receipts separately in protected staging for scoped enabled writes.
5. Deploy to staging only with separate Founder Jira scope grant and PAP-512's exact-green-SHA / isolated backend / protected real URL / rollback gates. No staging by FC2's current premerge mandate; FC1 merge-only, TOS Production six-app single train.

Source parity, fixture visual parity, and real functional staging truth are **three separate receipts**. All remain PENDING as of this audit.