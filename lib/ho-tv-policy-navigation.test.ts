/** PAP-650 / PNR-TV · PAP-1419 S4 navigation, PAP-1385 async DSA persistence. */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import type { BoField, BoRecord } from "./bo-registration";
import { PropertySections } from "../app/components/workspace-renderer/Properties";
import { readTvPolicyLocation, tvPolicyLocationUrl, tvPolicyS4State } from "./ho-tv-policy-navigation";
import { TvPolicyRecord } from "../app/ho/pinoria/tv-policies/TvPolicyRecord";

const policy: BoRecord = {
  id: "tvp1-default", name: "Ambient Welcome", typeName: "Ambient Welcome",
  scope: "DEFAULT", center: null, resolution: "PUBLISHED", inherited: null,
  active: 1, latest: 1, displaysCount: "—", aspectRatio: "16:9",
  createdAt: "—", createdByUser: "—", updatedAt: "—", updatedByUser: "—",
};
const props = {
  policy, centers: [], state: "ready" as const, tab: "overview" as const,
  onClose() {}, onDetail() {}, onTabChange() {},
  returnFocus() { return null; },
};
test("PAP-1419 S4 route preserves unrelated parameters and no Core authority from URL", () => {
  const source = "https://ho.staging.pinohouse.art/ho/pinoria/tv-policies?center=abc#panel";
  const drawer = tvPolicyLocationUrl(source, {policyId:policy.id,pane:"drawer",tab:"overview"});
  assert.match(drawer, /\?center=abc&policy=tvp1-default#panel$/);
  assert.deepEqual(readTvPolicyLocation(new URL(drawer,"https://x.local").search), {policyId:policy.id,pane:"drawer",tab:"overview"});
  const full = tvPolicyLocationUrl("https://x.local"+drawer, {policyId:policy.id,pane:"detail",tab:"history"});
  assert.match(full, /tvView=detail&tvTab=history/);
  assert.deepEqual(readTvPolicyLocation(new URL(full,"https://x.local").search),{policyId:policy.id,pane:"detail",tab:"history"});
  assert.equal(tvPolicyLocationUrl("https://x.local"+full, {policyId:null,pane:"drawer",tab:"overview"}),"/ho/pinoria/tv-policies?center=abc#panel");
  assert.equal(tvPolicyS4State("ready",false),"not-found");
  assert.equal(tvPolicyS4State("denied",true),"denied");
  assert.equal(tvPolicyS4State("unavailable",true),"unavailable");
});
test("V3.2 one shared DrawerFrame + all 13 approved read-only values + full detail", () => {
  const html = renderToStaticMarkup(createElement(TvPolicyRecord,{...props,pane:"drawer"}));
  assert.match(html,/data-tdd-shell="drawer"/);
  assert.match(html,/aria-modal="true"/);
  assert.match(html,/id="full-detail"/);
  assert.equal((html.match(/data-prop="/g)||[]).length,13);
  assert.match(html,/data-prop="createdByUser"/);
  assert.doesNotMatch(html,/data-prop="displaysCount"/);
  assert.doesNotMatch(html,/Lưu và phát hành|heartbeat|Mở TV|Cấp quyền/);
});
test("S4 shared DetailFrame Overview first, History last; unverified Core never renders fake editor", () => {
  const overview = renderToStaticMarkup(createElement(TvPolicyRecord,{...props,pane:"detail"}));
  assert.match(overview,/data-tdd-shell="detail"/);
  assert.match(overview,/id="back-to-list"/);
  assert.equal((overview.match(/class="v24-prop-item"/g)||[]).length,13);
  assert.match(overview,/data-pnr-tv-core-verified="false"/);
  assert.match(overview,/Đang xác minh cấu hình TV từ Core/);
  assert.doesNotMatch(overview,/data-detail-edit=|data-pnr-tv-write-verified/);
  assert.ok(overview.indexOf("Tổng quan") < overview.indexOf("Lịch sử"));
  assert.match(overview,/aria-label="Chỉ đọc Created Time"/);
  const history = renderToStaticMarkup(createElement(TvPolicyRecord,{...props,pane:"detail",tab:"history"}));
  assert.match(history,/data-pnr-tv-history="unavailable"/);
  assert.match(history,/Chưa có dữ liệu lịch sử Policy đã xác minh từ Core/);
  assert.doesNotMatch(history,/data-prop="createdAt"/);
});
test("S4 forbidden, unavailable and missing record never leak private fields", () => {
  for (const state of ["denied","unavailable","loading"] as const) {
    const html=renderToStaticMarkup(createElement(TvPolicyRecord,{...props,policy:null,state,pane:"drawer"}));
    assert.doesNotMatch(html,/data-prop="name"|Ambient Welcome/);
    assert.match(html,/disabled=""/);
  }
  const notFound=renderToStaticMarkup(createElement(TvPolicyRecord,{...props,policy:null,pane:"detail"}));
  assert.match(notFound,/Không tìm thấy bản ghi/);
});
test("PAP-1794 native DSA property trigger and readonly audit remain canonical after Core verification", () => {
  // The live HO editor deliberately renders NO edit buttons on the server.
  // Verify the reused canonical renderer against a trusted, post-GET projection here;
  // authenticated live UI behavior remains a separate Playwright G3/G4 gate.
  const fields: BoField[] = [
    {key:"name",label:"Tên TV",type:"text",icon:"Aa",w:220},
    {key:"visibilityScope",label:"Scope hiển thị",type:"select",icon:"",w:155,options:["DEFAULT","CENTER"]},
    {key:"centerIds",label:"Center hiển thị",type:"multiselect",icon:"",w:240,options:["Cần Thơ"]},
    {key:"createdAt",label:"Created Time",type:"text",icon:"",w:200},
  ];
  const record:BoRecord = {id:"tvp1-default",name:"Ambient Welcome",visibilityScope:"CENTER",centerIds:["Cần Thơ"],createdAt:"—"};
  const html=renderToStaticMarkup(createElement(PropertySections,{
    variant:"detail",fields,record,
    sections:[{id:"v",label:"Hiển thị TV",fields:fields.map(f=>f.key)}],
    canEdit:(field:BoField)=>field.key!=="createdAt",
    onEdit:()=>{},
  }));
  for (const key of ["name","visibilityScope","centerIds"]) {
    assert.match(html,new RegExp('class="v24-prop-value writable" data-prop="'+key+'" data-detail-edit="'+key+'"'));
  }
  assert.equal((html.match(/class="v24-prop-value writable"/g)||[]).length,3);
  assert.equal((html.match(/class="v24-edit-glyph"/g)||[]).length,3);
  assert.equal((html.match(/class="v24-prop-value readonly"/g)||[]).length,1);
  assert.doesNotMatch(html,/✎ Sửa|class="inline-custom-editor"/);
  const source = readFileSync(new URL("../app/ho/pinoria/tv-policies/TvPolicyVisibilityEditor.tsx",import.meta.url),"utf8");
  assert.match(source,/PropertySections variant="detail"/);
  assert.match(source,/canEdit=\{editable\}/);
  assert.match(source,/onEdit=\{\(field, anchor\)/);
  assert.match(source,/BoTypedEditor/);
  assert.match(source,/closeOnSave=\{false\}/);
  assert.match(source,/readTvVisibility/);
  assert.match(source,/saveTvVisibility/);
});
