import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(path, "utf8");
const full = read("app/bo/components/registration/BoFullDetail.tsx");
const parent = read("app/bo/components/registration/BoParentReadTabs.tsx");
const frame = read("app/components/workspace-renderer/DetailFrame.tsx");
const coreStyles = read("public/bo-authority-source/styles.css");
const scopedStyles = read("public/bo-authority-source/bo-scoped.css");

test("PAP-1029 Parent and Student delegate to one canonical Detail cover/hero owner", () => {
  assert.match(full, /if \(moduleKey === "parents"\) return <DetailFrame/);
  assert.match(full, /legacyContent=\{<BoParentReadTabs module=\{module\} record=\{record\} fullDetail\s*\/>\}/);
  assert.match(full, /return <DetailFrame title=\{record.name\}/);
  assert.doesNotMatch(full, /className="detail-cover"|className="detail-hero"/);
  assert.match(frame, /"detail-cover"/); assert.match(frame, /"detail-hero-primary"/);
  assert.match(frame, /id="detail-body" className="detail-main v25-full-width"/);
});
test("PAP-1029 Full Detail nav/body retain approved DS selectors; narrow Drawer uses property rows", () => {
  assert.match(parent, /const navigation = <div className="detail-tabs"/);
  assert.match(parent, /const panel = <section id="parent-tab-panel"/);
  assert.match(parent, /return fullDetail\s*\? <>\{navigation\}<div id="detail-body" className="detail-main v25-full-width"><div className="detail-panel v24-main-panel">\{panel\}/);
  assert.match(parent, /: <section aria-label="Parents & Guardians">\{navigation\}\{panel\}<\/section>/);
  assert.match(parent, /const overview = <PropertySections variant=\{fullDetail \? "detail" : "drawer"\}/);
  assert.doesNotMatch(parent, /<div className="v24-prop-grid">/);
  assert.match(parent, /aria-labelledby=\{"parent-tab-"\+tab\}/);
  for (const css of [coreStyles, scopedStyles]) assert.match(css, /#detail-body\.v25-full-width\s*\{\s*display:\s*block;/);
  for (const source of [parent, full, frame]) assert.doesNotMatch(source, /style=\{\{|<style|!important/);
});
test("other BO domain Details retain their business branches under the shared body", () => {
  for (const key of ["subscriptions", "students", "payroll-periods"]) assert.ok(full.includes(`moduleKey === "${key}"`));
  assert.match(frame, /className="detail-panel v24-main-panel"/);
  assert.equal([...full.matchAll(/<DetailFrame/g)].length, 2, "Parent compatibility and domain content share one frame implementation");
});
