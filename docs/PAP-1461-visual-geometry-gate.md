# PAP-1461 — UI Anti-Drift Geometry Gate

**Epic:** PAP-184 / PLT-UI-GOVERNANCE  
**Pilot feature:** PAP-1705 / PNR-AVATAR-CRUD  
**Defect:** PAP-1754 — BO Avatar Create Person option overlap

This operationalizes, but does **not** replace, PAP-184, PAP-1088, PAP-1055 and PAP-1056. The i5 authoritative prototype and authenticated Staging G3/G4 remain separate evidence. CI success never approves Founder FSG.

## Protected CI contract

`PR Validation` runs `node scripts/pap1461-visual-ci.mjs` after the BO/HO CSS authority checks. It launches a real headless Chrome/Chromium instance and loads the **same BO CSS authority files** used at runtime, including the generated BO-scoped stylesheet. The default PILOT is registered against real Avatar Create class markers; there is no alternate mock CSS.

At widths 320, 390, 768, 1024, and 1440, `inspectListboxGeometry` verifies:

- Presence/count of selectable options, minimum control height, text alignment, bounding rectangles and rendered text fragment rectangles (not only document scroll width).
- All visible child content fits inside the owning option and adjacent option boxes do not overlap.
- Document horizontal overflow and the scroll behavior of a bounded listbox.
- Explicit negative controls: reverting a button to 36px/centered/clipped must **FAIL**; missing the scoped authority stylesheet must **FAIL**.

The fixture has **four synthetic long-name choices**, including has-Avatar status text, without a Core call. Disabled and error behavior remain separate required G3/G4 scenarios when relevant; this pilot does not certify them. PNGs and JSON receipts are retained as GitHub Actions artifacts for seven days. A missing executable browser, CSS authority, expected DOM marker, fixture, or broken negative control is a **CI FAIL**; it is never silently skipped.

## Coverage boundary

The first registered control is **BO Avatar Person options** (PAP-1754). `scripts/pap1461-visual-geometry.mjs` is reusable by BO/HO/TOS control owners but does not magically certify unregistered modules, interaction semantics or live prototype parity.

For a new or materially changed complex control:
1. Own it under a named Feature Epic and Jira item.
2. Register an actual runtime CSS/DOM selector and challenging synthetic states, including long text, disabled and error where relevant, using the helper.
3. Add a negative control proving failure on the previously broken rule/asset.
4. Keep authority build and registration enforced in PR Validation; do not bypass the gate for green CI.
5. Independently compare i5 prototype vs **100%-served** Staging on five widths, keyboard/Tab/ShiftTab/Enter/Escape/focus/ARIA, overlays/scroll, screenshots and authenticated G4. Record PASS/FAIL/NOT_RUN by control.
6. Only present the feature's Founder gate when those separate checks are complete.

The pilot preserves the prior PAP-1754 authenticated Staging read-only evidence at `D:\pino-evidence\PAP-1754\staging-deployed-g3-receipt.json`. The CI fixture never opens or alters Production or Staging data.
