import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/ho/system/roles/HoRoleEditor.tsx", "utf8");
const styles = readFileSync("app/ho/ho-theme.css", "utf8");
const host = readFileSync("app/ho/system/roles/HoRolesTdd.tsx", "utf8");

test("PAP-1215: HO Roles DS styling is scoped to its TDD business editor", () => {
  assert.doesNotMatch(source, /HoRoleEditor\.module\.css/);
  assert.match(source, /className="ho-role-editor"/);
  assert.match(host, /@pino\/design-system\/components\.css/);
  assert.match(host, /@pino\/design-system\/bo-tokens\.css/);
  assert.match(source, /PropertySections/);
  assert.match(source, /TosCard/);
  assert.match(source, /TosButton/);
  assert.match(styles, /\[data-surface="ho"\] \.ho-role-editor/);
  assert.match(styles, /var\(--ds-primary/);
  assert.match(styles, /var\(--bo-color-border/);
  assert.match(styles, /\[data-surface="ho"\] \.ho-role-editor \[hidden\] \{ display: none !important; \}/);
  assert.doesNotMatch(styles, /(^|\n)\s*(?:body|html|:root|\*)\s*\{/);
  assert.doesNotMatch(styles, /(^|\n)\s*\[data-surface=["']bo["']\]/);
});
test("PAP-1215: Overview and permissions are visually styled without new navigation/ACL", () => {
  assert.match(source, /className="ho-role-overview" hidden=\{activeTab!=="overview"\}/);
  assert.match(source, /className="ho-role-technical"/);
  assert.match(source, /className="ho-role-permission-header"/);
  assert.match(source, /className="ho-role-groups"/);
  assert.match(source, /className="ho-role-permission-row"/);
  assert.match(source, /className="ho-role-actions"/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /focus-visible/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /\[aria-pressed="true"\]/);
  assert.match(source, /onSaved\(\)/);
  assert.match(source, /expectedUpdatedAt:current\.updatedAt/);
  assert.doesNotMatch(source, /ho-role-titlebar/);
});
