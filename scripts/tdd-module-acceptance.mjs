/** PAP-1077: test inputs and pending gates; never runtime data or auth grants. */
export function tddAcceptanceFiles({ base, surface, route }) {
  const gates = [
    { id: "G0", status: "PENDING", required: ["canonical shell ownership", "no shell/CSS forks", "exact route admission"], command: "npm run tdd:authority:check -- --base origin/main" },
    { id: "G1", status: "PENDING", required: ["typed schema", "BO Center or HO global authorized provider", "cross-surface denial", "truthful history"] },
    { id: "G2", status: "PENDING", required: ["Table search/filter/sort/columns/group/pagination", "Drawer Escape/focus trap/restore", "Detail tabs ARIA and keyboard", "Back/Forward/reload", "401/403/404", "stale/partial commit readback when declared"] },
    { id: "G3", status: "PENDING", required: ["Table/Drawer/Detail at all viewports", "document overflow", "one-column drawer", "approved prototype and reviewed images"] },
    { id: "G4", status: "PENDING", required: ["exact-main CI and guarded CD", "independent serving SHA/version/digest", "authenticated named module journey", "actual role and scope negatives", "retained fixtures"] },
  ];
  const plan = { schemaVersion: 1, route, surface, dsPackage: "@pino/design-system", status: "PENDING_CORE_AND_MODULE_ACCEPTANCE", viewports: [1440, 1024, 768, 390, 320], gates };
  const fixture = {
    synthetic: true, surface, usage: "Test input only. Does not implement a provider, principal, permission grant or live fixture.",
    rows: [
      { id: "019d2000-0001-7000-8000-000000000001", name: "SYNTHETIC DEMO 001", status: "Active" },
      { id: "019d2000-0001-7000-8000-000000000002", name: "SYNTHETIC DEMO 002", status: "Inactive" },
    ],
    scenarios: ["populated", "empty", "loading", "401", "403", "404", "stale", "partial", "long-unicode"],
  };
  const skeleton = `import test from "node:test";
import assert from "node:assert/strict";
// Replace each failure with real module assertions and evidence; do not skip or
// turn a missing contract into a passing fixture. See acceptance.plan.json.
test("G2 module interaction and scope acceptance", () => {
  assert.fail("TODO_TDD_G2_ACCEPTANCE: bind module browser/adapter tests including denied, stale and partial readback");
});
test("G3 module geometry and approved visual acceptance", () => {
  assert.fail("TODO_TDD_G3_ACCEPTANCE: verify all five widths and reviewed Table/Drawer/Detail images");
});
test("G4 authenticated Staging serving and business acceptance", () => {
  assert.fail("TODO_TDD_G4_ACCEPTANCE: verify current-main CI/CD, independent serving identity and authenticated module negatives");
});
`;
  return [
    { filename: base + "/acceptance.fixture.json", body: JSON.stringify(fixture, null, 2) + "\n" },
    { filename: base + "/acceptance.plan.json", body: JSON.stringify(plan, null, 2) + "\n" },
    { filename: base + "/acceptance.gates.test.mjs", body: skeleton },
  ];
}
