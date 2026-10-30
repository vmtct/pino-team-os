import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/ho/system/roles/HoRoleEditor.tsx", "utf8");
const styles = readFileSync("app/ho/system/roles/HoRoleEditor.module.css", "utf8");
const host = readFileSync("app/ho/system/roles/HoRolesTdd.tsx", "utf8");

test("PAP-1215: HO Roles DS styling is scoped to its TDD business editor", () => {
  assert.match(source, /import styles from "\.\/HoRoleEditor\.module\.css"/);
  assert.match(source, /className=\{styles\.editor\}/);
  assert.match(host, /@pino\/design-system\/components\.css/);
  assert.match(host, /@pino\/design-system\/bo-tokens\.css/);
  assert.match(source, /PropertySections/);
  assert.match(source, /TosCard/);
  assert.match(source, /TosButton/);
  assert.match(styles, /var\(--ds-primary/);
  assert.match(styles, /var\(--bo-color-border/);
  assert.match(styles, /\.editor \[hidden\] \{ display: none !important; \}/);
  assert.doesNotMatch(styles, /(^|\n)\s*(?:body|html|:root|\*)\s*\{/);
  assert.doesNotMatch(styles, /(^|\n)\s*\[data-surface=["']bo["']\]/);
});
test("PAP-1215: Overview and permissions are visually styled without new navigation/ACL", () => {
  assert.match(source, /className=\{styles\.overview\} hidden=\{activeTab!=="overview"\}/);
  assert.match(source, /className=\{styles\.technical\}/);
  assert.match(source, /className=\{styles\.permissionHeader\}/);
  assert.match(source, /className=\{styles\.groups\}/);
  assert.match(source, /className=\{styles\.permissionRow\}/);
  assert.match(source, /className=\{styles\.actions\}/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /focus-visible/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /\[aria-pressed="true"\]/);
  assert.match(source, /onSaved\(\)/);
  assert.match(source, /expectedUpdatedAt:current\.updatedAt/);
  assert.doesNotMatch(source, /ho-role-titlebar/);
});
