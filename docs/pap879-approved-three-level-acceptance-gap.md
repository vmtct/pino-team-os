# PAP-879 — Three-Level Founder Authority / Students & Classes Acceptance Gap

Date: 2026-10-24 ICT. Authority: Founder APPROVED **only** `Hồ Sơ Đăng Ký` in the immutable OneDrive snapshot `APPROVED_UI_AUTHORITY/PAP-879-BO-V2.3-20261022/source` at **Table, Quick View Drawer, Full Detail Page**. No blanket BO, Students or Classes approval.

## Serving receipts

- Protected UI-only staging: `/bo-ui-replica/playground.html` (canonical approved), `/bo-ui-replica/?module=students`, `/bo-ui-replica/?module=classes`.
- Serving Team commit: `a29227c0fff7bead77018182c10069ace5a76231`; confirmed Cloudflare version `4307a2b2-d859-4a89-bcae-90372755b3b1` 100%.
- Canonical playground loads `styles.css`, `playground.css`, `playground-v22.css`, `playground-v23.css`, and `playground.js`; its Table row opens typed Drawer, then `Full Detail` gives `Tổng quan / Hoạt động / Tài liệu` tabs. Verified live via authenticated i5 Chrome CDP.
- Students/Classes shell loads `styles.css` and `app.js` only. Students/Classes render as standalone prototype but do NOT automatically inherit approved typed Table/Drawer/Detail grammar.

## Mandatory gates before requesting approval for Students and Classes

| Gate | Baseline | Current evidence | Status |
| --- | --- | --- | --- |
| Table | Approved playground typed data-grid structure, visibility/saved views, styles and density | Students/Classes use a different `app.js` renderer | NOT VERIFIED |
| Drawer | Playground `playground.js` typed property controls and compact property sheet | `app.js` `drawDrawer()` synthesizes generic fields and `Mock interaction only` audit placeholder | MISMATCH |
| Full Detail | Approved playground three-tab shared skeleton + module-specific content slots | `app.js` separate Full Detail implementation; 1:1 comparison not completed | NOT VERIFIED |
| Responsive | Reference 390/768/1280+ layouts and overlay behavior | 390 and 1280 no outer overflow observed; pixel parity not tested | PARTIAL |
| Runtime backend | None for UI-only approval, original controls without implemented functions may do nothing | Static replica isolated from Core; live staging retains Cloudflare Access | PASS for isolation |

## Work direction

1. **Do not edit approved immutable snapshot** or retroactively claim Students/Classes approved.
2. Refactor Students/Classes presentation to reuse approved playground three-level design primitives, retaining correct module-specific field data and labels. Do not invent fake workflows; unimplemented controls inert. Do not connect Core during UI-only stage.
3. Verify screenshots and interactions on authenticated preview at three levels for both Students and Classes (mobile 390 and desktop 1280/1440). Source code checks and CI alone cannot establish visual parity.
4. Request Founder UI approval for Students/Classes only after actual parity PASS; functional wiring afterwards, separately gated.
5. PAP-938/TOS unchanged until Founder explicitly approves carrying this process over. Production HOLD.