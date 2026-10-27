import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path,"utf8");
const full=read("app/bo/components/registration/BoFullDetail.tsx");
const parent=read("app/bo/components/registration/BoParentReadTabs.tsx");
const coreStyles=read("public/bo-authority-source/styles.css");
const scopedStyles=read("public/bo-authority-source/bo-scoped.css");

test("PAP-1029 Parent and Student share canonical Detail cover/hero structure",()=>{
  const start=full.indexOf('if (moduleKey === "parents") return');
  const end=full.indexOf('  return <section id="detail-screen">',start);
  assert.ok(start>0&&end>start,"parent detail branch present");
  const slice=full.slice(start,end);
  assert.match(slice, /<section id="detail-screen">\s*<div className="detail-cover">/);
  assert.match(slice, /<div className="detail-hero"><div className="detail-hero-primary">/);
  assert.match(slice, /<BoParentReadTabs module=\{module\} record=\{record\} fullDetail\s*\/>/);
  assert.doesNotMatch(slice, /<\/div>\s*<div className="detail-main/,"Parent Detail body must not escape cover");
  assert.match(full.slice(end),/id="detail-body" className="detail-main v25-full-width"/);
});
test("PAP-1029 Full Detail nav and panel use existing DS classes and selector, no ad-hoc sizing",()=>{
  assert.match(parent,/const navigation = <div className="detail-tabs"/);
  assert.match(parent,/const panel = <section id="parent-tab-panel"/);
  assert.match(parent,/return fullDetail\s*\? <>\{navigation\}<div id="detail-body" className="detail-main v25-full-width"><div className="detail-panel v24-main-panel">\{panel\}/);
  assert.match(parent,/: <section aria-label="Parents & Guardians">\{navigation\}\{panel\}<\/section>/);
  assert.match(coreStyles,/#detail-body\.v25-full-width\s*\{\s*display:\s*block;/);
  assert.match(scopedStyles,/#detail-body\.v25-full-width\s*\{\s*display:\s*block;/);
  assert.doesNotMatch(parent,/style=\{\{|<style|!important/);
  assert.doesNotMatch(full,/style=\{\{|<style|!important/);
});
test("other BO domain details retain the same canonical body",()=>{
  assert.match(full,/moduleKey === "subscriptions"/);
  assert.match(full,/moduleKey === "students"/);
  assert.match(full,/moduleKey === "payroll-periods"/);
  assert.match(full,/className="detail-panel v24-main-panel"/);
  assert.equal([...full.matchAll(/id="detail-screen"/g)].length,2,"one Parent and one shared canonical domain");
});
