import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

test("PAP-2012 business tabs explicitly reuse the V2.5 shared detail profile", () => {
 const require = createRequire(import.meta.url), prior = require.extensions[".css"];
 require.extensions[".css"] = m => { m.exports = { root:"profile-root", cover:"profile-cover", tabs:"profile-tabs", body:"profile-body", panel:"profile-panel" }; };
 try {
  const { BoFullDetail } = require("../app/bo/components/BoFullDetail") as typeof import("../app/bo/components/BoFullDetail");
  const tabs = [{id:"overview",label:"Thông tin",content:"Read only"}, {id:"settlements",label:"Quyết Toán",content:"Settlement"}];
  const props = {title:"Synthetic payroll",currentUrl:"/bo/payroll-periods?record=a",returnTo:"/bo/payroll-periods",tabs,activeTab:"settlements"};
  const html = renderToStaticMarkup(createElement(BoFullDetail,{...props,designVariant:"business-v25"}));
  assert.match(html,/data-bo-detail-version="v25"/);
  assert.match(html,/class="detail-hero-back"[^>]*aria-label="Quay lại bảng"/); assert.doesNotMatch(html,/← Về bảng/);
  const legacy = renderToStaticMarkup(createElement(BoFullDetail,props)); assert.match(legacy,/← Về bảng/); assert.doesNotMatch(legacy,/class="detail-hero-back"/);
  assert.match(html,/profile-cover/); assert.match(html,/profile-tabs/); assert.match(html,/profile-panel/);
  assert.match(html,/aria-selected="true"[^>]*>Quyết Toán/);
  assert.equal((html.match(/data-tdd-shell="detail"/g)||[]).length,1);
  assert.throws(()=>renderToStaticMarkup(createElement(BoFullDetail,{...props,designVariant:"v25"})),/Invalid BO V2.5/);
  assert.throws(()=>renderToStaticMarkup(createElement(BoFullDetail,{...props,designVariant:"business-v25",tabs:[tabs[0],tabs[0]]})),/Invalid BO detail tabs/);
 } finally { if(prior) require.extensions[".css"]=prior; else delete require.extensions[".css"]; }
});

test("PAP-2012 native period and both income details opt in, with scoped settlement emphasis",()=>{
 const period=readFileSync("app/bo/payroll-periods/BoNativePayrollPeriods.tsx","utf8");
 const income=readFileSync("app/bo/payroll-periods/PayrollIncomeDetail.tsx","utf8");
 assert.equal((period.match(/designVariant="business-v25"/g)||[]).length,1);
 assert.equal((income.match(/designVariant="business-v25"/g)||[]).length,2);
 assert.match(period,/className="pay-kpi-grid"/);
 assert.equal((period.match(/className="pay-kpi"/g)||[]).length,2);
 assert.match(period,/className="secondary-btn"/); assert.match(period,/className="pay-settlement-actions"/); assert.match(period,/pay-section-heading/); assert.match(period,/align:"right"/); assert.equal((income.match(/<BoProperties authority compact/g)||[]).length,4);
 const css=readFileSync("public/bo-authority-source/styles.css","utf8");
 assert.ok(css.includes(".pay-kpi:nth-child(2){border-color:var(--bo-color-focus);background:var(--bo-color-accent-soft)}"));
});
