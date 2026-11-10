/** PAP-650 / PNR-TV · PAP-1419 S4 URL contract + shared Drawer/Detail regression. */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { BoRecord } from "./bo-registration";
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
test("S4 shared DetailFrame Overview first, History last; History never invented", () => {
  const overview = renderToStaticMarkup(createElement(TvPolicyRecord,{...props,pane:"detail"}));
  assert.match(overview,/data-tdd-shell="detail"/);
  assert.match(overview,/id="back-to-list"/);
  assert.equal((overview.match(/class="v24-prop-item"/g)||[]).length,16);
  assert.ok(overview.indexOf("Tổng quan") < overview.indexOf("Lịch sử"));
  assert.match(overview,/aria-label="Chỉ đọc Created Time"/);
  const history = renderToStaticMarkup(createElement(TvPolicyRecord,{...props,pane:"detail",tab:"history"}));
  assert.match(history,/data-pnr-tv-history="unavailable"/);
  assert.match(history,/Chưa có dữ liệu lịch sử Policy đã xác minh từ Core/);
  assert.doesNotMatch(history,/data-prop="createdAt"/);
});
test("S4 forbidden or unavailable and missing record never leak private fields", () => {
  for (const state of ["denied","unavailable","loading"] as const) {
    const html=renderToStaticMarkup(createElement(TvPolicyRecord,{...props,policy:null,state,pane:"drawer"}));
    assert.doesNotMatch(html,/data-prop="name"|Ambient Welcome/);
    assert.match(html,/disabled=""/);
  }
  const notFound=renderToStaticMarkup(createElement(TvPolicyRecord,{...props,policy:null,pane:"detail"}));
  assert.match(notFound,/Không tìm thấy bản ghi/);
});


test("PAP-1794 DSA inline Full Detail uses whole writable property cell and readonly audit rows", () => {
  const html=renderToStaticMarkup(createElement(TvPolicyRecord,{...props,centers:[{id:"019b1126-0001-7000-8000-000000000001",name:"Cần Thơ"}],pane:"detail"}));
  for(const key of ["name","visibilityScope","centerIds"]){
    assert.match(html,new RegExp("class=\"v24-prop-value writable\" data-prop=\""+key+"\" data-detail-edit=\""+key+"\""));
  }
  assert.equal((html.match(/class="v24-prop-value writable"/g)||[]).length,3);
  assert.equal((html.match(/class="v24-prop-value readonly"/g)||[]).length,13);
  assert.equal((html.match(/class="v24-edit-glyph"/g)||[]).length,3);
  assert.doesNotMatch(html,/✎ Sửa|class="inline-custom-editor"/);
});
