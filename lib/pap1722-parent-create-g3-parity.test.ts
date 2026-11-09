// PAP-1722 / SCH-PARENTS-GUARDIANS — protect the Founder-approved i5 Create Drawer G3.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const drawer = readFileSync(new URL("../app/bo/parents/ParentCreateDrawer.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/bo-authority-source/bo-form-extension.css", import.meta.url), "utf8");
const hoCss = readFileSync(new URL("../public/ho-authority-source/ho-scoped.css", import.meta.url), "utf8");
const boCss = readFileSync(new URL("../public/bo-authority-source/bo-scoped.css", import.meta.url), "utf8");

test("PAP-1722: Parent Create uses the canonical two-row DSA primitive and no surplus hint", () => {
  assert.match(drawer, /<PropertySections variant="drawer"/);
  assert.match(drawer, /createFields=\{\{/);
  assert.doesNotMatch(drawer, /<label className="property-row"/);
  assert.doesNotMatch(drawer, /className="settings-hint"/);
  assert.match(drawer, /<form id="parent-create-form" onSubmit=/);
  assert.match(drawer, /inferParentContactType\(contactValue\)/);
  assert.match(drawer, /onCreated\(result\)/);
});

test("PAP-1722: canonical BO CSS matches i5 input geometry without unscoped overrides", () => {
  const inputRule = css.match(/#drawer #parent-create-form \.os-create-select\s*\{([^}]+)\}/)?.[1];
  assert.ok(inputRule, "Expected scoped canonical OS input rule in BO authority CSS");
  assert.match(inputRule, /min-height:\s*38px/);
  assert.match(inputRule, /font-size:\s*13px/);
  assert.match(inputRule, /width:\s*100%/);
  assert.match(css, /#drawer-content\s*>\s*#parent-create-form\s*>\s*\.property-section\s*\{\s*margin:\s*0/);
  assert.match(boCss, /#parent-create-form/);
  assert.doesNotMatch(hoCss, /#parent-create-form/, "BO Create Drawer declarations must never leak into HO");
});

test("PAP-1722: Parent Create focuses the first input after shared dialog mount and preserves invoker focus", () => {
  const policy = readFileSync(new URL("../app/bo/components/registration/useBoDialog.ts", import.meta.url), "utf8");
  assert.match(policy, /focusables\(\)\[0\]\?\.focus\(\)/, "Default shared dialog focus order remains untouched");
  assert.match(drawer, /const nameInputRef = useRef<HTMLInputElement>\(null\)/);
  assert.match(drawer, /requestAnimationFrame\(\(\) => nameInputRef\.current\?\.focus\(\)\)/);
  assert.match(drawer, /cancelAnimationFrame\(frame\)/);
  assert.match(drawer, /inputRef: nameInputRef/);
  assert.doesNotMatch(drawer, /\bautoFocus\b/, "Native autofocus must not steal useBoDialog's invoker origin");
});
